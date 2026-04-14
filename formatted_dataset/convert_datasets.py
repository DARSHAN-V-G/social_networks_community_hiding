"""
Dataset Converter for HS Algorithm
=====================================
Converts all 9 datasets into a uniform format:

For each dataset folder inside formatted_dataset/:
  - edges.txt       -> each line: "node_u node_v"  (space-separated, 0-indexed)
  - communities.txt -> each line: "node_id community_id"  (0-indexed nodes, if ground truth exists)
  - info.json       -> metadata: name, num_nodes, num_edges, num_communities, has_ground_truth

Run this script from the project root:
    python formatted_dataset/convert_datasets.py
"""

import os
import re
import json

# ── paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
DATASETS_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "datasets")
OUT_DIR      = SCRIPT_DIR          # formatted_dataset/


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def write_edges(out_folder, edges):
    """Write edge list: each line 'u v' (0-indexed)."""
    os.makedirs(out_folder, exist_ok=True)
    with open(os.path.join(out_folder, "edges.txt"), "w") as f:
        for u, v in sorted(edges):
            f.write(f"{u} {v}\n")


def write_communities(out_folder, node_community):
    """Write community assignments: each line 'node_id community_id'."""
    with open(os.path.join(out_folder, "communities.txt"), "w") as f:
        for node, comm in sorted(node_community.items()):
            f.write(f"{node} {comm}\n")


def write_info(out_folder, name, edges, node_community, has_ground_truth):
    """Write metadata JSON."""
    nodes = set()
    for u, v in edges:
        nodes.add(u)
        nodes.add(v)
    num_communities = len(set(node_community.values())) if node_community else 0
    info = {
        "name":             name,
        "num_nodes":        len(nodes),
        "num_edges":        len(edges),
        "num_communities":  num_communities,
        "has_ground_truth": has_ground_truth,
    }
    with open(os.path.join(out_folder, "info.json"), "w") as f:
        json.dump(info, f, indent=2)
    return info


# ─────────────────────────────────────────────────────────────────────────────
# Parsers
# ─────────────────────────────────────────────────────────────────────────────

def parse_gml(filepath):
    """
    Parse a GML file.
    Returns:
        edges           -> list of (u, v)  (0-indexed)
        node_community  -> dict {node_id: community_id}  or {}
    Node IDs are re-mapped to 0-indexed integers.
    'value' field in nodes is used as community id (if present).
    """
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    # ── nodes ────────────────────────────────────────────────────────────────
    node_blocks = re.findall(r'node\s*\[(.*?)\]', text, re.DOTALL)
    raw_id_to_community = {}   # original id -> community (or None)
    original_ids = []

    for block in node_blocks:
        id_m   = re.search(r'\bid\s+(-?\d+)', block)
        val_m  = re.search(r'\bvalue\s+(-?\d+)', block)
        if not id_m:
            continue
        orig_id = int(id_m.group(1))
        original_ids.append(orig_id)
        raw_id_to_community[orig_id] = int(val_m.group(1)) if val_m else None

    # Build 0-indexed mapping (sorted by original id for determinism)
    original_ids_sorted = sorted(original_ids)
    id_map = {orig: idx for idx, orig in enumerate(original_ids_sorted)}

    has_communities = any(v is not None for v in raw_id_to_community.values())
    node_community = {}
    if has_communities:
        for orig_id, comm in raw_id_to_community.items():
            node_community[id_map[orig_id]] = comm if comm is not None else -1

    # ── edges ────────────────────────────────────────────────────────────────
    edge_blocks = re.findall(r'edge\s*\[(.*?)\]', text, re.DOTALL)
    edges = set()
    for block in edge_blocks:
        src_m = re.search(r'\bsource\s+(-?\d+)', block)
        tgt_m = re.search(r'\btarget\s+(-?\d+)', block)
        if not src_m or not tgt_m:
            continue
        u = id_map[int(src_m.group(1))]
        v = id_map[int(tgt_m.group(1))]
        if u != v:
            edge = (min(u, v), max(u, v))
            edges.add(edge)

    return list(edges), node_community


def parse_edge_list(filepath, comment_chars=None, one_indexed=False):
    """
    Parse a plain edge-list text file.
    Lines that start with a comment char are skipped.
    Returns edges as list of (u, v)  (0-indexed).
    """
    if comment_chars is None:
        comment_chars = ['#', '%', '!', '/']
    edges = set()
    all_nodes = set()

    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line[0] in comment_chars:
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            try:
                u, v = int(parts[0]), int(parts[1])
            except ValueError:
                continue
            all_nodes.add(u)
            all_nodes.add(v)
            if u != v:
                edges.add((u, v))

    # Re-map to 0-indexed
    sorted_nodes = sorted(all_nodes)
    id_map = {n: i for i, n in enumerate(sorted_nodes)}
    edges_mapped = set()
    for u, v in edges:
        mu, mv = id_map[u], id_map[v]
        edges_mapped.add((min(mu, mv), max(mu, mv)))

    return list(edges_mapped)


def parse_mtx(filepath):
    """
    Parse a MatrixMarket (.mtx) coordinate-format file.
    Skips header lines starting with '%'.
    Returns edges as list of (u, v) (0-indexed).
    """
    edges = set()
    all_nodes = set()

    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('%'):
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            try:
                u, v = int(parts[0]), int(parts[1])
            except ValueError:
                continue
            all_nodes.add(u)
            all_nodes.add(v)
            if u != v:
                edges.add((u, v))

    # Re-map 1-indexed MTX ids to 0-indexed
    sorted_nodes = sorted(all_nodes)
    id_map = {n: i for i, n in enumerate(sorted_nodes)}
    edges_mapped = set()
    for u, v in edges:
        mu, mv = id_map[u], id_map[v]
        edges_mapped.add((min(mu, mv), max(mu, mv)))

    return list(edges_mapped)


# ─────────────────────────────────────────────────────────────────────────────
# Per-dataset converters
# ─────────────────────────────────────────────────────────────────────────────

def convert_football():
    src = os.path.join(DATASETS_DIR, "football", "football.gml")
    out = os.path.join(OUT_DIR, "football")
    edges, node_community = parse_gml(src)
    write_edges(out, edges)
    write_communities(out, node_community)
    return write_info(out, "football", edges, node_community, has_ground_truth=True)


def convert_karate():
    src = os.path.join(DATASETS_DIR, "karate", "karate.gml")
    out = os.path.join(OUT_DIR, "karate")
    edges, node_community = parse_gml(src)
    # karate.gml has no 'value' field — add well-known Zachary ground truth
    # (2 communities: nodes 1-17 -> group 0, nodes 18-34 -> group 1, 1-indexed original)
    # We use the standard split: IDs 1..17 -> community 0, IDs 18..34 -> community 1
    # Since GML IDs are 1-based and re-mapped to 0-based: 0..16 -> 0, 17..33 -> 1
    node_community = {n: (0 if n <= 16 else 1) for n in range(34)}
    write_edges(out, edges)
    write_communities(out, node_community)
    return write_info(out, "karate", edges, node_community, has_ground_truth=True)


def convert_dolphin():
    src = os.path.join(DATASETS_DIR, "dolphin", "dolphins.gml")
    out = os.path.join(OUT_DIR, "dolphin")
    edges, node_community = parse_gml(src)
    write_edges(out, edges)
    if node_community:
        write_communities(out, node_community)
    return write_info(out, "dolphin", edges, node_community, has_ground_truth=bool(node_community))


def convert_facebook():
    src = os.path.join(DATASETS_DIR, "facebook", "facebook_combined.txt")
    out = os.path.join(OUT_DIR, "facebook")
    edges = parse_edge_list(src)
    write_edges(out, edges)
    return write_info(out, "facebook", edges, {}, has_ground_truth=False)


def convert_erdos():
    src = os.path.join(DATASETS_DIR, "erdos", "ca-Erdos992.mtx")
    out = os.path.join(OUT_DIR, "erdos")
    edges = parse_mtx(src)
    write_edges(out, edges)
    return write_info(out, "erdos", edges, {}, has_ground_truth=False)


def convert_astro_physics():
    src = os.path.join(DATASETS_DIR, "astro-physics", "astro-ph.gml")
    out = os.path.join(OUT_DIR, "astro-physics")
    edges, node_community = parse_gml(src)
    write_edges(out, edges)
    if node_community:
        write_communities(out, node_community)
    return write_info(out, "astro-physics", edges, node_community, has_ground_truth=bool(node_community))


def convert_co_authorship():
    src = os.path.join(DATASETS_DIR, "co-authorship", "netscience.gml")
    out = os.path.join(OUT_DIR, "co-authorship")
    edges, node_community = parse_gml(src)
    write_edges(out, edges)
    if node_community:
        write_communities(out, node_community)
    return write_info(out, "co-authorship", edges, node_community, has_ground_truth=bool(node_community))


def convert_powergrid():
    src = os.path.join(DATASETS_DIR, "powergrid", "power.gml")
    out = os.path.join(OUT_DIR, "powergrid")
    edges, node_community = parse_gml(src)
    write_edges(out, edges)
    if node_community:
        write_communities(out, node_community)
    return write_info(out, "powergrid", edges, node_community, has_ground_truth=bool(node_community))


def convert_uspoliticsbooks():
    src = os.path.join(DATASETS_DIR, "uspoliticsbooks", "polbooks.gml")
    out = os.path.join(OUT_DIR, "uspoliticsbooks")
    edges, node_community = parse_gml(src)
    write_edges(out, edges)
    if node_community:
        write_communities(out, node_community)
    return write_info(out, "uspoliticsbooks", edges, node_community, has_ground_truth=bool(node_community))


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    converters = [
        ("football",        convert_football),
        ("karate",          convert_karate),
        ("dolphin",         convert_dolphin),
        ("facebook",        convert_facebook),
        ("erdos",           convert_erdos),
        ("astro-physics",   convert_astro_physics),
        ("co-authorship",   convert_co_authorship),
        ("powergrid",       convert_powergrid),
        ("uspoliticsbooks", convert_uspoliticsbooks),
    ]

    print(f"\n{'Dataset':<20} {'Nodes':>8} {'Edges':>8} {'Comms':>6} {'Ground Truth'}")
    print("-" * 60)

    for name, fn in converters:
        try:
            info = fn()
            gt = "Yes" if info["has_ground_truth"] else "No"
            print(f"{info['name']:<20} {info['num_nodes']:>8} {info['num_edges']:>8} "
                  f"{info['num_communities']:>6} {gt}")
        except Exception as e:
            print(f"{name:<20} ERROR: {e}")

    print("\nDone! All datasets written to:", OUT_DIR)
    print("\nFormat per dataset folder:")
    print("  edges.txt       -> 'node_u node_v'  (one edge per line, 0-indexed)")
    print("  communities.txt -> 'node_id comm_id' (one node per line, 0-indexed)")
    print("  info.json       -> metadata (name, num_nodes, num_edges, ...)")
