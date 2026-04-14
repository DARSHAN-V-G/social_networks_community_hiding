"""
=============================================================================
  PERSON 2 — Evaluation Algorithm: Evaluating Community Hiding
=============================================================================

TASK:
    Implement the evaluation framework (Algorithm 2) from the paper:
    "Community Hiding by Link Perturbation in Social Networks"
    (Chen et al., IEEE TCSS 2021).

    This module does NOT hide communities — it MEASURES how well a hiding
    algorithm worked, using 3 metrics: Modularity, Safeness, and H-score.

YOUR JOB:
    Complete every function marked with  # TODO  below.
    Do NOT change the function signatures.

INPUTS:
    - edges           : list of (u, v) — original graph edges (0-indexed)
    - communities     : dict {node_id: community_id} — detected communities
    - target_comm_id  : int — the community we tried to hide
    - budget β        : int — number of link perturbations allowed

OUTPUT:
    A results dict containing before/after values of:
        - Modularity  MG(C̄)
        - Safeness    σ(C)
        - H-score     H(C, C̄)

ALGORITHM OVERVIEW (Algorithm 2 from paper):
    Before hiding:
        1. Run community detection on G → get C̄
        2. Pick target community C ∈ C̄
        3. Compute Modularity, Safeness, H-score on original G

    Apply hiding:
        4. Run Hs (or Ds/Dm) on G with budget β → get G'

    After hiding:
        5. Run same community detection on G' → get C̄'
        6. Compute Modularity, Safeness, H-score on G'
        7. Return comparison of before vs after

KEY METRICS:

    1. MODULARITY — measures how well the graph is divided into communities:
       MG(C̄) = η/m - δ/(4m²)
       where:
         η = Σ_{Ci ∈ C̄} |E(Ci)|    (number of intra-community edges)
         δ = Σ_{Ci ∈ C̄} deg(Ci)²   (sum of squared community degrees)
         m = total number of edges

    2. SAFENESS — σ(C) is implemented in hs_algorithm.py.
       Import and reuse compute_safeness() from there.

    3. H-SCORE — the primary evaluation metric (equation 15):
       H(C, C̄) = connectivity_factor × (0.5*(1 - max_recall) + 0.5*(1 - avg_precision))
       where:
         connectivity_factor = 1 - |S(C) - 1| / (|C| - 1)
           |S(C)| = number of connected components in the subgraph of C's members
         Recall    R(Ci, C) = |Ci ∩ C| / |C|        for each detected Ci
         Precision P(Ci, C) = |Ci ∩ C| / |Ci|       for each detected Ci that overlaps C
         max_recall   = max over all Ci of R(Ci, C)
         avg_precision = mean of P(Ci, C) over all Ci that overlap C

       H ranges from 0 to 1:
         H = 1 → perfectly hidden (members in 1 connected component, spread across many communities)
         H = 0 → detection succeeded (community fully found), or members disconnected

COMMUNITY DETECTION:
    You need to re-run a community detection algorithm on the graph.
    Use the python-igraph library (same as the paper).
    Supported algorithms (abbreviations from paper):
        'LPA'  → Label Propagation
        'IMP'  → InfoMap
        'MLE'  → MultiLevel (Louvain)
        'SGL'  → SpinGlass
        'LEI'  → Leading Eigenvectors

REFERENCES:
    Paper Section V-D and V-E, Algorithm 2 (pages 710–711)
=============================================================================
"""

from collections import defaultdict
from hs_algorithm import compute_safeness, build_adj
from utils import load_dataset, get_community_nodes


# ─────────────────────────────────────────────────────────────────────────────
# COMMUNITY DETECTION WRAPPER
# ─────────────────────────────────────────────────────────────────────────────

def run_community_detection(edges, all_nodes, algorithm='LPA'):
    """
    Run a community detection algorithm using the igraph library.

    Args:
        edges      : list of (u, v) — graph edges
        all_nodes  : set of all node IDs
        algorithm  : str — one of 'LPA', 'IMP', 'MLE', 'SGL', 'LEI'

    Returns:
        dict {node_id: community_id} — detected community assignment
    """
    # TODO: Use igraph to build the graph and run the chosen algorithm.
    # Steps:
    #   1. import igraph
    #   2. Create igraph.Graph with the edge list
    #   3. Run the appropriate detection method:
    #       LPA → community_label_propagation()
    #       IMP → community_infomap()
    #       MLE → community_multilevel()
    #       SGL → community_spinglass()
    #       LEI → community_leading_eigenvector()
    #   4. Convert igraph membership list → dict {node_id: community_id}
    pass


# ─────────────────────────────────────────────────────────────────────────────
# METRIC FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def compute_modularity(edges, detected_communities):
    """
    Compute modularity MG(C̄) = η/m - δ/(4m²).

    Args:
        edges                : list of (u, v)
        detected_communities : dict {node_id: community_id}

    Returns:
        float — modularity score
    """
    # TODO:
    # 1. m = len(edges)
    # 2. Group nodes by community
    # 3. η = number of edges where both endpoints are in same community
    # 4. For each community Ci, deg(Ci) = sum of degrees of its members
    # 5. δ = sum of deg(Ci)² over all communities
    # 6. Return η/m - δ/(4*m²)
    pass


def compute_connected_components(community_nodes, adj):
    """
    Find the number of connected components |S(C)| in the subgraph
    induced by community_nodes (using only edges between nodes in C).

    Args:
        community_nodes : set of node IDs in the target community
        adj             : dict {node: set of neighbors}

    Returns:
        int — number of connected components in the community subgraph
    """
    # TODO: BFS/DFS restricted to community_nodes
    pass


def compute_recall(detected_communities, target_nodes):
    """
    Compute recall R(Ci, C) for all detected communities Ci.
    R(Ci, C) = |Ci ∩ C| / |C|

    Args:
        detected_communities : dict {node_id: community_id}
        target_nodes         : set of original target community members

    Returns:
        dict {community_id: recall_value}
    """
    # TODO
    pass


def compute_precision(detected_communities, target_nodes):
    """
    Compute precision P(Ci, C) for all detected communities that overlap C.
    P(Ci, C) = |Ci ∩ C| / |Ci|

    Args:
        detected_communities : dict {node_id: community_id}
        target_nodes         : set of original target community members

    Returns:
        dict {community_id: precision_value}  (only for overlapping communities)
    """
    # TODO
    pass


def compute_h_score(target_nodes, detected_communities, adj):
    """
    Compute the H-score (equation 15 from paper).
    H = connectivity_factor × (0.5*(1 - max_recall) + 0.5*(1 - avg_precision))

    Args:
        target_nodes         : set of original target community node IDs
        detected_communities : dict {node_id: community_id} — AFTER hiding
        adj                  : adjacency dict of AFTER-hiding graph

    Returns:
        float — H-score in [0, 1]
    """
    # TODO:
    # 1. num_components = compute_connected_components(target_nodes, adj)
    # 2. connectivity = 1 - (num_components - 1) / (len(target_nodes) - 1)
    # 3. recalls    = compute_recall(detected_communities, target_nodes)
    # 4. precisions = compute_precision(detected_communities, target_nodes)
    # 5. max_recall    = max(recalls.values())
    # 6. avg_precision = mean(precisions.values())
    # 7. Return connectivity * (0.5*(1-max_recall) + 0.5*(1-avg_precision))
    pass


# ─────────────────────────────────────────────────────────────────────────────
# MAIN EVALUATION FRAMEWORK
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_hiding(edges, target_comm_id, communities_gt, budget,
                    hiding_fn, detection_algorithm='LPA'):
    """
    Full evaluation pipeline (Algorithm 2 from paper).

    Args:
        edges              : list of (u, v) — original graph edges
        target_comm_id     : int — ID of the community to hide
        communities_gt     : dict {node_id: community_id} — ground-truth communities
                             (used only to identify which nodes belong to target C)
        budget             : int — β, number of allowed link changes
        hiding_fn          : callable — the hiding function to evaluate.
                             Signature: hiding_fn(edges, community_nodes, budget) → new_edges
        detection_algorithm: str — which community detection algorithm to use

    Returns:
        dict with keys:
            'before': {'modularity': float, 'safeness': float, 'h_score': float}
            'after' : {'modularity': float, 'safeness': float, 'h_score': float}
    """
    all_nodes = set(n for edge in edges for n in edge)

    # ── Step 1: Get target community nodes from ground truth
    target_nodes = get_community_nodes(communities_gt, target_comm_id)

    # ── Step 2: Run community detection on original graph G
    detected_before = run_community_detection(edges, all_nodes, detection_algorithm)

    # ── Step 3: Compute BEFORE metrics
    adj_before = build_adj(edges)
    mod_before  = compute_modularity(edges, detected_before)
    safe_before = compute_safeness(target_nodes, adj_before)
    h_before    = compute_h_score(target_nodes, detected_before, adj_before)

    # ── Step 4: Apply hiding algorithm
    new_edges = hiding_fn(edges, target_nodes, budget)

    # ── Step 5: Run community detection on updated graph G'
    detected_after = run_community_detection(new_edges, all_nodes, detection_algorithm)

    # ── Step 6: Compute AFTER metrics
    adj_after  = build_adj(new_edges)
    mod_after  = compute_modularity(new_edges, detected_after)
    safe_after = compute_safeness(target_nodes, adj_after)
    h_after    = compute_h_score(target_nodes, detected_after, adj_after)

    return {
        'before': {
            'modularity': mod_before,
            'safeness':   safe_before,
            'h_score':    h_before,
        },
        'after': {
            'modularity': mod_after,
            'safeness':   safe_after,
            'h_score':    h_after,
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT (for standalone testing)
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from hs_algorithm import hs_algorithm
    from utils import load_dataset

    dataset_name      = "karate"   # change to any dataset folder name
    target_comm_id    = 0
    budget            = 5
    detection_algo    = "LPA"      # LPA | IMP | MLE | SGL | LEI

    edges, communities, info = load_dataset(dataset_name)
    print(f"Dataset : {info['name']}  |  Nodes: {info['num_nodes']}  |  Edges: {info['num_edges']}")

    results = evaluate_hiding(
        edges, target_comm_id, communities,
        budget, hs_algorithm, detection_algo
    )

    print(f"\n{'Metric':<15} {'Before':>10} {'After':>10}")
    print("-" * 38)
    for metric in ['modularity', 'safeness', 'h_score']:
        b = results['before'][metric]
        a = results['after'][metric]
        print(f"{metric:<15} {b:>10.4f} {a:>10.4f}")
