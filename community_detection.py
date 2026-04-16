"""
=============================================================================
  Community Detection — All 5 Algorithms (as used in the paper)
=============================================================================

PAPER REFERENCE:
    "Community Hiding by Link Perturbation in Social Networks"
    Chen et al., IEEE TCSS 2021 — Section V-B

ALGORITHMS USED (all available in Python igraph):
    LPA  — Label Propagation Algorithm
    IMP  — InfoMap Algorithm
    MLE  — MultiLevel Algorithm (Louvain)
    SGL  — SpinGlass Algorithm
    LEI  — Leading Eigenvectors Algorithm

OUTPUT:
    For every dataset × algorithm combination, a communities file is saved at:
        detected_communities/<dataset>/<algorithm>/communities.txt
    Format: one line per node → "node_id  community_id"

    A summary JSON is also saved at:
        detected_communities/<dataset>/<algorithm>/info.json

USAGE:
    python community_detection.py
    python community_detection.py --dataset karate
    python community_detection.py --dataset karate --algo LPA
=============================================================================
"""

import os
import json
import time
import argparse
from collections import defaultdict

import igraph as ig

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

DATASETS_DIR   = "formatted_dataset"
OUTPUT_DIR     = "detected_communities"

# All datasets available
ALL_DATASETS = [
    "karate",
    "dolphin",
    "football",
    "uspoliticsbooks",
    "facebook",
    "powergrid",
    "erdos",
    "astro-physics",
    "co-authorship",
]

# Algorithms that the paper uses (Section V-B)
# Key  = short abbreviation  (used in folder name)
# Value = human-readable name
ALGORITHMS = {
    "LPA": "Label Propagation",
    "IMP": "InfoMap",
    "MLE": "MultiLevel (Louvain)",
    "SGL": "SpinGlass",
    "LEI": "Leading Eigenvectors",
}

# Some algorithms are too slow for large graphs (paper notes this too).
# SpinGlass and MultiLevel are skipped on very large datasets by the paper.
SKIP_ON_LARGE = {
    "SGL": ["facebook", "powergrid", "erdos", "astro-physics", "co-authorship"],
    "MLE": ["powergrid", "erdos", "astro-physics"],
}

LARGE_GRAPH_THRESHOLD = 1000  # nodes — used only for console warnings


# ─────────────────────────────────────────────────────────────────────────────
# LOAD DATASET (edges only — we don't need ground-truth communities here)
# ─────────────────────────────────────────────────────────────────────────────

def load_edges(dataset_name):
    """Load raw edges from formatted_dataset/<name>/edges.txt."""
    path = os.path.join(DATASETS_DIR, dataset_name, "edges.txt")
    edges = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                parts = line.split()
                u, v = int(parts[0]), int(parts[1])
                edges.append((u, v))
    return edges


def load_info(dataset_name):
    """Load info.json for a dataset."""
    path = os.path.join(DATASETS_DIR, dataset_name, "info.json")
    with open(path) as f:
        return json.load(f)


# ─────────────────────────────────────────────────────────────────────────────
# BUILD IGRAPH GRAPH
# ─────────────────────────────────────────────────────────────────────────────

def build_igraph(edges):
    """
    Build an igraph.Graph from a list of (u, v) integer edge tuples.
    Node IDs are remapped to 0-indexed internally; the mapping is returned
    so results can be translated back to original IDs.

    Returns:
        g         : igraph.Graph  (undirected, no self-loops, no multi-edges)
        id_to_idx : dict {original_node_id -> igraph_vertex_index}
        idx_to_id : dict {igraph_vertex_index -> original_node_id}
    """
    # Collect unique nodes in sorted order for stable mapping
    all_nodes = sorted(set(n for e in edges for n in e))
    id_to_idx = {nid: idx for idx, nid in enumerate(all_nodes)}
    idx_to_id = {idx: nid for nid, idx in id_to_idx.items()}

    n = len(all_nodes)
    g = ig.Graph(n=n, directed=False)

    # Add edges (deduplicated, no self-loops)
    seen = set()
    igraph_edges = []
    for u, v in edges:
        if u == v:
            continue
        key = (min(u, v), max(u, v))
        if key not in seen:
            seen.add(key)
            igraph_edges.append((id_to_idx[u], id_to_idx[v]))

    g.add_edges(igraph_edges)

    # igraph algorithms require a connected graph for some methods.
    # We work on the largest connected component (LCC) when needed.
    return g, id_to_idx, idx_to_id


# ─────────────────────────────────────────────────────────────────────────────
# RUN COMMUNITY DETECTION
# ─────────────────────────────────────────────────────────────────────────────

def detect_communities(g, algo):
    """
    Run the selected community detection algorithm on igraph Graph g.

    Args:
        g    : igraph.Graph
        algo : str — one of LPA, IMP, MLE, SGL, LEI

    Returns:
        igraph.VertexClustering — the detected community partition
    """
    if algo == "LPA":
        return g.community_label_propagation()
    elif algo == "IMP":
        return g.community_infomap()
    elif algo == "MLE":
        return g.community_multilevel()
    elif algo == "SGL":
        # SpinGlass requires a connected graph
        components = g.connected_components()
        lcc_indices = components.giant().vs["name"] if g.vs and "name" in g.vs.attributes() else None
        # Work on giant component
        giant = components.giant()
        return giant.community_spinglass()
    elif algo == "LEI":
        return g.community_leading_eigenvector()
    else:
        raise ValueError(f"Unknown algorithm: {algo}")


# ─────────────────────────────────────────────────────────────────────────────
# SAVE RESULTS
# ─────────────────────────────────────────────────────────────────────────────

def save_communities(membership, idx_to_id, output_path, dataset_name, algo, elapsed, num_edges):
    """
    Save community assignments to a text file.

    membership  : list[int] — community ID for each igraph vertex index
    idx_to_id   : dict {igraph_idx -> original_node_id}
    output_path : str — directory to save into
    """
    os.makedirs(output_path, exist_ok=True)

    comm_file = os.path.join(output_path, "communities.txt")
    with open(comm_file, "w") as f:
        f.write("# node_id  community_id\n")
        for idx, comm_id in enumerate(membership):
            original_id = idx_to_id[idx]
            f.write(f"{original_id}\t{comm_id}\n")

    # Compute summary stats
    from collections import Counter
    comm_sizes = Counter(membership)
    num_communities = len(comm_sizes)
    sizes = sorted(comm_sizes.values(), reverse=True)
    largest = sizes[0] if sizes else 0
    smallest = sizes[-1] if sizes else 0
    avg_size = sum(sizes) / len(sizes) if sizes else 0

    info = {
        "dataset": dataset_name,
        "algorithm": algo,
        "algorithm_full": ALGORITHMS[algo],
        "num_nodes": len(membership),
        "num_edges": num_edges,
        "num_communities": num_communities,
        "largest_community": largest,
        "smallest_community": smallest,
        "avg_community_size": round(avg_size, 2),
        "runtime_seconds": round(elapsed, 4),
        "output_file": "communities.txt",
    }

    info_file = os.path.join(output_path, "info.json")
    with open(info_file, "w") as f:
        json.dump(info, f, indent=2)

    return info


# ─────────────────────────────────────────────────────────────────────────────
# MAIN RUNNER
# ─────────────────────────────────────────────────────────────────────────────

def run_detection(dataset_name, algo):
    """Run one dataset × algorithm combination."""
    print(f"\n  [{algo}] {ALGORITHMS[algo]} on '{dataset_name}' ...")

    # Check skip list
    skip_list = SKIP_ON_LARGE.get(algo, [])
    if dataset_name in skip_list:
        print(f"  [SKIP] Skipped: paper skips {algo} on {dataset_name} (too slow/incompatible)")
        return None

    # Load data
    try:
        edges = load_edges(dataset_name)
        dataset_info = load_info(dataset_name)
    except FileNotFoundError as e:
        print(f"  [FAIL] Dataset not found: {e}")
        return None

    if not edges:
        print(f"  [FAIL] No edges found for '{dataset_name}'")
        return None

    # Build igraph
    g, id_to_idx, idx_to_id = build_igraph(edges)

    num_nodes = g.vcount()
    num_edges = g.ecount()

    if num_nodes >= LARGE_GRAPH_THRESHOLD:
        print(f"     (Large graph: {num_nodes:,} nodes, {num_edges:,} edges - may take a while)")

    # SpinGlass needs connected graph → use giant component
    if algo == "SGL" and not g.is_connected():
        print(f"     Graph not fully connected; using giant component for SGL.")
        components = g.connected_components()
        giant = components.giant()

        # Remap idx_to_id for giant component
        giant_node_names = giant.vs["name"] if "name" in giant.vs.attributes() else list(range(giant.vcount()))
        # We stored original vertex indices, not names — rebuild mapping from giant
        giant_indices = components.giant().vs.indices  # vertices in giant
        giant_idx_to_id = {new_i: idx_to_id[old_i] for new_i, old_i in enumerate(giant_indices)}

        try:
            t0 = time.time()
            partition = giant.community_spinglass()
            elapsed = time.time() - t0
        except Exception as e:
            print(f"  [FAIL] SGL failed: {e}")
            return None

        output_path = os.path.join(OUTPUT_DIR, dataset_name, algo)
        info = save_communities(partition.membership, giant_idx_to_id, output_path,
                                dataset_name, algo, elapsed, num_edges)

    else:
        # Run detection
        try:
            t0 = time.time()
            partition = detect_communities(g, algo)
            elapsed = time.time() - t0
        except Exception as e:
            print(f"  [FAIL] {algo} failed on {dataset_name}: {e}")
            return None

        output_path = os.path.join(OUTPUT_DIR, dataset_name, algo)
        info = save_communities(partition.membership, idx_to_id, output_path,
                                dataset_name, algo, elapsed, num_edges)

    print(f"  [OK]  Found {info['num_communities']} communities "
          f"(largest={info['largest_community']}, avg={info['avg_community_size']}) "
          f"in {elapsed:.3f}s")
    print(f"     -> saved to {output_path}/")

    return info


def run_all(datasets=None, algos=None):
    """Run all dataset × algorithm combinations and print a final summary."""
    datasets = datasets or ALL_DATASETS
    algos    = algos    or list(ALGORITHMS.keys())

    results = []
    failed  = []

    print("=" * 70)
    print("  Community Detection - All Algorithms")
    print("  Paper: Chen et al., IEEE TCSS 2021")
    print("=" * 70)

    for dataset in datasets:
        print(f"\n{'-'*60}")
        print(f"  Dataset: {dataset}")
        print(f"{'-'*60}")
        for algo in algos:
            info = run_detection(dataset, algo)
            if info:
                results.append(info)
            else:
                failed.append((dataset, algo))

    # ── Final summary table ──────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  SUMMARY")
    print("=" * 70)
    print(f"  {'Dataset':<20} {'Algo':<6} {'#Comm':>6} {'Largest':>8} {'Avg':>7} {'Time(s)':>9}")
    print(f"  {'-'*64}")
    for r in results:
        print(f"  {r['dataset']:<20} {r['algorithm']:<6} "
              f"{r['num_communities']:>6} {r['largest_community']:>8} "
              f"{r['avg_community_size']:>7.1f} {r['runtime_seconds']:>9.3f}")

    if failed:
        print(f"\n  Skipped/Failed combinations ({len(failed)}):")
        for d, a in failed:
            print(f"    {a} on {d}")

    # Save master summary
    summary_path = os.path.join(OUTPUT_DIR, "summary.json")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(summary_path, "w") as f:
        json.dump({"completed": results, "failed": [{"dataset": d, "algo": a} for d, a in failed]}, f, indent=2)
    print(f"\n  Master summary -> {summary_path}")
    print("=" * 70)


# -----------------------------------------------------------------------------
# CLI
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run community detection (LPA/IMP/MLE/SGL/LEI) on social network datasets."
    )
    parser.add_argument(
        "--dataset", "-d",
        help="Run only this dataset (default: all datasets)",
        default=None,
        choices=ALL_DATASETS,
    )
    parser.add_argument(
        "--algo", "-a",
        help="Run only this algorithm (default: all algorithms)",
        default=None,
        choices=list(ALGORITHMS.keys()),
    )
    args = parser.parse_args()

    datasets = [args.dataset] if args.dataset else None
    algos    = [args.algo]    if args.algo    else None

    run_all(datasets=datasets, algos=algos)
