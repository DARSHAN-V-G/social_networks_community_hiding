"""
visualize.py — Interactive community hiding visualizer
======================================================
Asks user for:
  1. Dataset name
  2. Community detection algorithm
  3. Target community ID
  4. Budget (β)

Then shows:
  LEFT  — Graph BEFORE hiding  (communities color-coded, target bordered red)
  RIGHT — Graph AFTER  hiding  (re-detected communities, added/removed edges highlighted)
  BOT   — Metrics bar: modularity, safeness, H-score before vs after

Usage:
    python visualize.py
"""

import sys
import random
import matplotlib
matplotlib.use("TkAgg")          # use interactive window; change to "Agg" to save file
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import networkx as nx

# ── imports from your existing files ──────────────────────────────────────────
from utils import load_dataset, get_community_nodes
from hs_algorithm import hs_algorithm, build_adj, compute_safeness
from evaluation import compute_modularity, compute_h_score


ALGO_NAMES = {
    "LPA": "Label Propagation",
    "IMP": "InfoMap",
    "MLE": "MultiLevel (Louvain)",
    "SGL": "SpinGlass",
    "LEI": "Leading Eigenvectors",
}


def run_community_detection(edges, algo):
    """
    Local igraph-based community detection with correct node ID remapping.
    Fixes the out-of-range vertex ID bug in evaluation.py.
    """
    import igraph as ig
    all_nodes = sorted(set(n for e in edges for n in e))
    id_to_idx = {nid: idx for idx, nid in enumerate(all_nodes)}
    idx_to_id = {idx: nid for nid, idx in id_to_idx.items()}

    g = ig.Graph(n=len(all_nodes), directed=False)
    seen = set()
    ig_edges = []
    for u, v in edges:
        if u == v:
            continue
        key = (min(u, v), max(u, v))
        if key not in seen:
            seen.add(key)
            ig_edges.append((id_to_idx[u], id_to_idx[v]))
    g.add_edges(ig_edges)

    if algo == "LPA":
        comm = g.community_label_propagation()
    elif algo == "IMP":
        comm = g.community_infomap()
    elif algo == "MLE":
        comm = g.community_multilevel()
    elif algo == "SGL":
        if not g.is_connected():
            g = g.connected_components().giant()
            # rebuild idx_to_id for giant
            giant_indices = g.vs.indices
            idx_to_id = {new_i: idx_to_id[old_i] for new_i, old_i in enumerate(giant_indices)}
        comm = g.community_spinglass()
    elif algo == "LEI":
        comm = g.community_leading_eigenvector()
    else:
        raise ValueError(f"Unknown algo: {algo}")

    result = {}
    for idx, cid in enumerate(comm.membership):
        original_id = idx_to_id[idx]
        result[original_id] = cid
    return result


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

DATASETS = [
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

# Which algorithms are valid for each dataset (from paper + our run results)
VALID_ALGOS = {
    "karate":         ["LPA", "IMP", "MLE", "SGL", "LEI"],
    "dolphin":        ["LPA", "IMP", "MLE", "SGL", "LEI"],
    "football":       ["LPA", "IMP", "MLE", "SGL", "LEI"],
    "uspoliticsbooks":["LPA", "IMP", "MLE", "SGL", "LEI"],
    "facebook":       ["LPA", "IMP", "MLE",         "LEI"],
    "powergrid":      ["LPA", "IMP",                "LEI"],
    "erdos":          ["LPA", "IMP"                      ],
    "astro-physics":  ["LPA", "IMP"                      ],
    "co-authorship":  ["LPA", "IMP", "MLE"               ],
}

# Color palette for communities (cyclic)
PALETTE = [
    "#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F",
    "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC",
    "#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD",
]


# ─────────────────────────────────────────────────────────────────────────────
# USER INPUT
# ─────────────────────────────────────────────────────────────────────────────

def ask_dataset():
    import json, os
    print("\n" + "=" * 65)
    print("  Community Hiding Visualizer")
    print("=" * 65)
    print(f"\n  {'#':>2}  {'Dataset':<18} {'Nodes':>7} {'Edges':>8}  Valid Algos")
    print(f"  {'-'*62}")
    for i, d in enumerate(DATASETS, 1):
        try:
            with open(os.path.join("formatted_dataset", d, "info.json")) as f:
                info = json.load(f)
            nodes = info.get("num_nodes", "?")
            edges = info.get("num_edges", "?")
        except Exception:
            nodes = edges = "?"
        algos_str = ", ".join(VALID_ALGOS.get(d, []))
        print(f"  {i:>2}. {d:<18} {nodes:>7} {edges:>8}  {algos_str}")
    while True:
        val = input("\nSelect dataset number (or type name): ").strip()
        if val.isdigit() and 1 <= int(val) <= len(DATASETS):
            return DATASETS[int(val) - 1]
        if val in DATASETS:
            return val
        print("  Invalid choice. Try again.")


def ask_algo(dataset_name):
    valid = VALID_ALGOS.get(dataset_name, list(ALGO_NAMES.keys()))
    # Assign display numbers only to valid algos
    numbered = {str(i+1): algo for i, algo in enumerate(valid)}
    print(f"\nAvailable algorithms for '{dataset_name}':")
    for k, v in numbered.items():
        print(f"  {k}. {v:5}  ({ALGO_NAMES[v]})")
    while True:
        val = input("\nSelect algorithm number (or code e.g. LPA): ").strip().upper()
        if val in numbered:
            return numbered[val]
        if val in valid:
            return val
        print(f"  Invalid. Choose from: {', '.join(valid)}")


def ask_community(communities):
    comm_ids = sorted(set(communities.values()))
    sizes = {cid: sum(1 for v in communities.values() if v == cid) for cid in comm_ids}
    print(f"\nDetected {len(comm_ids)} communities:")
    for cid in comm_ids:
        print(f"  Community {cid:3} - {sizes[cid]} nodes")
    while True:
        val = input("\nSelect target community ID: ").strip()
        if val.isdigit() and int(val) in comm_ids:
            return int(val)
        print("  Invalid ID. Try again.")


def ask_budget(community_nodes):
    n = len(community_nodes)
    default = max(1, min(n, 10))
    val = input(f"\nEnter budget B (default={default}): ").strip()
    if val.isdigit() and int(val) > 0:
        return int(val)
    return default


# ─────────────────────────────────────────────────────────────────────────────
# BUILD NETWORKX GRAPH
# ─────────────────────────────────────────────────────────────────────────────

LARGE_GRAPH_THRESHOLD = 500   # nodes above this → ego-network view
LEGEND_MAX_COMMS      = 12    # max community entries in legend before collapsing


def build_nx(edges):
    """Build undirected NetworkX graph from edge list."""
    G = nx.Graph()
    G.add_edges_from(edges)
    return G


def build_ego_subgraph(G, target_nodes):
    """
    For large graphs: extract target community + all direct (1-hop) neighbors.
    Returns the subgraph and a subtitle annotation.
    """
    neighbors = set()
    for n in target_nodes:
        if n in G:
            neighbors.update(G.neighbors(n))
    ego_nodes = set(target_nodes) | neighbors
    sub = G.subgraph(ego_nodes).copy()
    note = f"(ego-network: {len(target_nodes)} target + {len(neighbors-target_nodes)} neighbors)"
    return sub, note


def get_layout(G):
    """
    Choose layout algorithm based on graph size for best readability.
    """
    n = len(G.nodes())
    try:
        if n <= 150:
            # Small: spring layout — good for community structure
            return nx.spring_layout(G, seed=42, k=2.0 / (n ** 0.5 + 1))
        elif n <= 600:
            # Medium: kamada-kawai — minimizes edge crossings
            return nx.kamada_kawai_layout(G)
        else:
            # Large: spectral — based on graph Laplacian eigenvectors
            return nx.spectral_layout(G)
    except Exception:
        return nx.random_layout(G, seed=42)


# ─────────────────────────────────────────────────────────────────────────────
# DRAW ONE GRAPH PANEL
# ─────────────────────────────────────────────────────────────────────────────

def draw_graph(ax, G, pos, communities_map, target_nodes,
               title, added_edges=None, removed_edges=None, subtitle=""):
    """
    Draw a graph with communities color-coded.
    Scales node size with graph size. Legend capped at LEGEND_MAX_COMMS.
    """
    n = len(G.nodes())
    ax.set_title(title, fontsize=12, fontweight="bold", pad=8)
    if subtitle:
        ax.set_xlabel(subtitle, fontsize=8, labelpad=4, color="#555555")
    ax.axis("off")

    # Scale node sizes inversely with graph size
    if n <= 100:
        sz_target, sz_other = 280, 160
        edge_w = 0.9
    elif n <= 400:
        sz_target, sz_other = 160, 90
        edge_w = 0.6
    else:
        sz_target, sz_other = 80, 40
        edge_w = 0.3

    # Assign colors per community
    comm_ids = sorted(set(communities_map.values()))
    target_comm = communities_map.get(next(iter(target_nodes)), -1) if target_nodes else -1
    # Build color map: target community gets a distinct slot, rest cycle PALETTE
    comm_color = {}
    palette_idx = 0
    for cid in comm_ids:
        if cid == target_comm:
            comm_color[cid] = "#FF6B6B"   # soft red for target community fill
        else:
            comm_color[cid] = PALETTE[palette_idx % len(PALETTE)]
            palette_idx += 1

    # Node colors and sizes
    node_colors, node_sizes, node_lw, node_ec = [], [], [], []
    for node in G.nodes():
        cid  = communities_map.get(node, -1)
        color = comm_color.get(cid, "#BBBBBB")
        node_colors.append(color)
        if node in target_nodes:
            node_sizes.append(sz_target)
            node_lw.append(2.2)
            node_ec.append("#CC0000")
        else:
            node_sizes.append(sz_other)
            node_lw.append(0.5)
            node_ec.append("#444444")

    # Classify edges
    added_set   = set(tuple(sorted(e)) for e in (added_edges   or []))
    removed_set = set(tuple(sorted(e)) for e in (removed_edges or []))
    normal_edges, added_draw, removed_draw = [], [], []
    for u, v in G.edges():
        key = tuple(sorted((u, v)))
        if   key in added_set:   added_draw.append((u, v))
        elif key in removed_set: removed_draw.append((u, v))
        else:                    normal_edges.append((u, v))

    # Draw edges
    nx.draw_networkx_edges(ax=ax, G=G, pos=pos, edgelist=normal_edges,
                           edge_color="#CCCCCC", width=edge_w, alpha=0.6)
    if added_draw:
        nx.draw_networkx_edges(ax=ax, G=G, pos=pos, edgelist=added_draw,
                               edge_color="#27AE60", width=edge_w*3, alpha=0.95)
    if removed_draw:
        nx.draw_networkx_edges(ax=ax, G=G, pos=pos, edgelist=removed_draw,
                               edge_color="#E74C3C", width=edge_w*2.5,
                               alpha=0.9, style="dashed")

    # Draw nodes
    nx.draw_networkx_nodes(ax=ax, G=G, pos=pos,
                           node_color=node_colors, node_size=node_sizes,
                           linewidths=node_lw, edgecolors=node_ec)

    # Node labels only for very small graphs
    if n <= 60:
        nx.draw_networkx_labels(ax=ax, G=G, pos=pos,
                                font_size=6, font_color="#111111")

    # ── Legend (capped) ───────────────────────────────────────────────────────
    handles = []
    # Highlight target community first
    handles.append(mpatches.Patch(
        facecolor=comm_color.get(target_comm, "#FF6B6B"),
        edgecolor="#CC0000", linewidth=2,
        label=f"Target Community {target_comm} ({len(target_nodes)} nodes)"))

    # Other communities (up to LEGEND_MAX_COMMS-1 more entries)
    other_ids = [cid for cid in comm_ids if cid != target_comm]
    shown = other_ids[:LEGEND_MAX_COMMS - 1]
    hidden_count = len(other_ids) - len(shown)
    for cid in shown:
        handles.append(mpatches.Patch(color=comm_color[cid], label=f"Comm {cid}"))
    if hidden_count > 0:
        handles.append(mpatches.Patch(color="#BBBBBB",
                                      label=f"Other ({hidden_count} more comms)"))

    # Edge type markers
    handles.append(mpatches.Patch(facecolor="white", edgecolor="#CC0000",
                                  linewidth=2, label="Target node (red border)"))
    if added_draw:
        handles.append(mpatches.Patch(facecolor="#27AE60", label="Added edge"))
    if removed_draw:
        handles.append(mpatches.Patch(facecolor="#E74C3C", label="Removed edge"))

    ax.legend(handles=handles, loc="upper left", fontsize=7.5,
              framealpha=0.9, ncols=1)


# ─────────────────────────────────────────────────────────────────────────────
# METRICS BAR CHART
# ─────────────────────────────────────────────────────────────────────────────

def draw_metrics(ax, results):
    metrics   = ["Modularity", "Safeness (sigma)", "H-Score"]
    before    = [results["before"]["modularity"],
                 results["before"]["safeness"],
                 results["before"]["h_score"]]
    after     = [results["after"]["modularity"],
                 results["after"]["safeness"],
                 results["after"]["h_score"]]

    x = range(len(metrics))
    w = 0.32

    bars_b = ax.bar([i - w/2 for i in x], before, width=w,
                    color="#4E79A7", label="Before hiding", zorder=3)
    bars_a = ax.bar([i + w/2 for i in x], after,  width=w,
                    color="#F28E2B", label="After hiding",  zorder=3)

    for bar in bars_b:
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, h + 0.01,
                f"{h:.3f}", ha="center", va="bottom", fontsize=8)
    for bar in bars_a:
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, h + 0.01,
                f"{h:.3f}", ha="center", va="bottom", fontsize=8)

    ax.set_xticks(list(x))
    ax.set_xticklabels(metrics, fontsize=10)
    ax.set_ylabel("Value", fontsize=9)
    ax.set_title("Evaluation Metrics - Before vs After Hiding", fontsize=12, fontweight="bold")
    ax.legend(fontsize=9)
    ax.grid(axis="y", linestyle="--", alpha=0.4, zorder=0)
    ax.set_ylim(0, max(max(before), max(after)) * 1.25 + 0.05)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    # ── Step 1: User input ────────────────────────────────────────────────────
    dataset_name = ask_dataset()

    print(f"\nLoading '{dataset_name}' ...")
    edges, communities_gt, info = load_dataset(dataset_name)
    all_nodes = set(n for e in edges for n in e)

    print(f"  Nodes: {info['num_nodes']}  |  Edges: {info['num_edges']}")

    algo = ask_algo(dataset_name)

    # Run community detection to show available community IDs
    print(f"\nRunning {algo} ({ALGO_NAMES[algo]}) ...")
    detected_before = run_community_detection(edges, algo)

    target_comm_id  = ask_community(detected_before)
    target_nodes    = get_community_nodes(detected_before, target_comm_id)

    budget = ask_budget(target_nodes)

    print(f"\nRunning Hs hiding algorithm (budget={budget}) ...")

    # ── Step 2: Run hiding ────────────────────────────────────────────────────
    new_edges = hs_algorithm(edges, target_nodes, budget)

    # Compute sets of added/removed edges
    before_set = set(tuple(sorted(e)) for e in edges)
    after_set  = set(tuple(sorted(e)) for e in new_edges)
    added_edges   = after_set  - before_set
    removed_edges = before_set - after_set

    print(f"  Edges before : {len(edges)}")
    print(f"  Edges after  : {len(new_edges)}")
    print(f"  Added        : {len(added_edges)}")
    print(f"  Removed      : {len(removed_edges)}")

    # ── Step 3: Evaluate ──────────────────────────────────────────────────────
    adj_before      = build_adj(edges)
    adj_after       = build_adj(new_edges)
    detected_after  = run_community_detection(new_edges, algo)

    results = {
        "before": {
            "modularity": compute_modularity(edges,     detected_before),
            "safeness":   compute_safeness(target_nodes, adj_before),
            "h_score":    compute_h_score(target_nodes, detected_before, adj_before),
        },
        "after": {
            "modularity": compute_modularity(new_edges, detected_after),
            "safeness":   compute_safeness(target_nodes, adj_after),
            "h_score":    compute_h_score(target_nodes, detected_after, adj_after),
        },
    }

    print(f"  {'Metric':<15} {'Before':>8} {'After':>8}")
    print(f"  {'-'*33}")
    for m in ["modularity", "safeness", "h_score"]:
        b = results["before"][m]
        a = results["after"][m]
        arrow = "^" if a > b else ("v" if a < b else "=")
        print(f"  {m:<15} {b:>8.4f} {a:>8.4f}  {arrow}")

    # ── Step 4: Build NetworkX graphs ─────────────────────────────────────────
    G_before = build_nx(edges)
    G_after  = build_nx(new_edges)
    total_nodes = len(G_before.nodes())

    is_large = total_nodes >= LARGE_GRAPH_THRESHOLD

    if is_large:
        # For large graphs: show only ego-network (target + 1-hop neighbors)
        print(f"\n  Large graph ({total_nodes} nodes): visualizing ego-network around target community.")
        G_vis_before, ego_note = build_ego_subgraph(G_before, target_nodes)
        G_vis_after,  _        = build_ego_subgraph(G_after,  target_nodes)
        # Restrict added/removed to ego subgraph nodes
        ego_nodes = set(G_vis_before.nodes()) | set(G_vis_after.nodes())
        added_edges   = {e for e in added_edges   if e[0] in ego_nodes and e[1] in ego_nodes}
        removed_edges = {e for e in removed_edges if e[0] in ego_nodes and e[1] in ego_nodes}
    else:
        G_vis_before = G_before
        G_vis_after  = G_after
        ego_note = ""

    # Compute layout on before-graph (same positions for both panels)
    pos = get_layout(G_vis_before)
    for node in G_vis_after.nodes():
        if node not in pos:
            pos[node] = (random.uniform(-1, 1), random.uniform(-1, 1))

    # ── Step 5: Draw ──────────────────────────────────────────────────────────
    fig = plt.figure(figsize=(18, 11))
    fig.patch.set_facecolor("#F8F9FA")

    # Title bar
    fig.suptitle(
        f"Community Hiding - Hs Algorithm\n"
        f"Dataset: {info['name']}   |   Detection: {algo} ({ALGO_NAMES[algo]})"
        f"   |   Target: Community {target_comm_id} ({len(target_nodes)} nodes)"
        f"   |   Budget B={budget}",
        fontsize=12, fontweight="bold", y=0.99
    )

    # Grid: 2 graph panels (top) + 1 metrics panel (bottom)
    gs = fig.add_gridspec(2, 2, height_ratios=[3, 1], hspace=0.35, wspace=0.15,
                          top=0.93, bottom=0.05, left=0.04, right=0.97)

    ax_before  = fig.add_subplot(gs[0, 0])
    ax_after   = fig.add_subplot(gs[0, 1])
    ax_metrics = fig.add_subplot(gs[1, :])

    draw_graph(
        ax=ax_before, G=G_vis_before, pos=pos,
        communities_map=detected_before,
        target_nodes=target_nodes,
        title=f"BEFORE Hiding  ({len(edges)} edges)",
        subtitle=ego_note,
    )

    draw_graph(
        ax=ax_after, G=G_vis_after, pos=pos,
        communities_map=detected_after,
        target_nodes=target_nodes,
        title=f"AFTER Hiding  ({len(new_edges)} edges,  +{len(added_edges)} added,  -{len(removed_edges)} removed)",
        added_edges=added_edges,
        removed_edges=removed_edges,
        subtitle=ego_note,
    )

    draw_metrics(ax_metrics, results)

    import os
    os.makedirs("results", exist_ok=True)
    fname = f"results/hiding_{dataset_name}_{algo}_comm{target_comm_id}_B{budget}.png"
    plt.savefig(fname, dpi=150, bbox_inches="tight")
    print(f"\n  Plot saved to {fname}")
    plt.show()


if __name__ == "__main__":
    main()
