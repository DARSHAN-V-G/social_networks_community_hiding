"""
=============================================================================
  PERSON 1 — Hs Algorithm: Community Hiding via Safeness
=============================================================================

TASK:
    Implement the Hs greedy community hiding algorithm (Algorithm 1) from the
    paper: "Community Hiding by Link Perturbation in Social Networks"
    (Chen et al., IEEE TCSS 2021).

YOUR JOB:
    Complete every function marked with  # TODO  below.
    Do NOT change the function signatures.

INPUTS (provided via main.py / load_dataset):
    - edges       : list of (u, v) tuples — undirected graph edges (0-indexed)
    - communities : dict {node_id: community_id} — ground-truth community labels
    - budget β    : int — max number of link add/delete operations allowed

OUTPUT:
    - updated edges list after hiding the target community

ALGORITHM OVERVIEW (Algorithm 1 from paper):
    1. Repeat until budget β is exhausted:
       a. Find the node np in C with the LOWEST ratio of outside-links / degree
          → this is the node most "trapped" inside the community
       b. Find a random external node nt (not in C, not already linked to np)
       c. Compute addition gain Φ_add for adding edge (np, nt)
       d. Find the best intra-C edge (nk, nl) to delete (excluding bridges)
       e. Compute deletion gain Φ_del for deleting (nk, nl)
       f. If Φ_add >= Φ_del and Φ_add > 0  → ADD edge (np, nt)
          Elif Φ_del > 0                    → DELETE edge (nk, nl)
       g. β = β - 1

KEY FORMULAS:
    ρ(C)      = sum of all shortest path lengths between pairs u,v ∈ C
    ρ_min     = 2(n-1)²          [star graph]
    ρ_max     = Σ_{k=1}^{n} (Σ_{i=1}^{n-k} i + Σ_{j=0}^{k-1} j)   [line graph]

    ψ(C)      = (ρ(C) - ρ_min) / (ρ_max - ρ_min)     [intra-community safeness]

    ϕ(C)      = Σ_{u∈C} |inter_links(u)| / deg(u)    [inter-community safeness]

    σ(C)      = 0.5 * ψ(C) + 0.5 * ϕ(C)              [total community safeness]

    Φ(C)      = σ(C') - σ(C)                          [safeness gain after update]

THEOREMS (proven in paper — use these as rules):
    Theorem 1: inter-C link ADDITION  → Φ ≥ 0  (always good)
    Theorem 2: intra-C link ADDITION  → Φ < 0  (always bad — NEVER do this)
    Theorem 3: inter-C link DELETION  → Φ ≤ 0  (always bad — NEVER do this)
    Theorem 4: intra-C link DELETION  → Φ > 0  (always good, if not a bridge)

REFERENCES:
    Paper Section IV, Algorithm 1 (page 709)
=============================================================================
"""

import random
import heapq
from collections import defaultdict
from collections import deque
from utils import load_dataset, build_graph, get_community_nodes

def compute_rho(community, adj):
    dist = 0
    for source in community:
        visited={source : 0}
        queue=deque([source])
        while queue :
            current=queue.popleft()
            cur_dist=visited[current]
            for n in adj[current]:
                if n in community and n not in visited:
                    visited[n]=cur_dist + 1
                    queue.append(n)
        for n,d in visited.items():
            if n!=source:
                dist+=d
    return dist

def compute_rho_min(n):
    return 2*(n-1)**2   #mentioned in the paper for star topology

def compute_rho_max(n):
    dist=0
    for k in range(1,n+1):
        m=n-k
        r=m*(m+1)//2
        l=k*(k-1)//2
        dist+= r + l
    return dist


def compute_psi(community, adj):
    l = len(community)
    if l<=1 : return 0.0
    rho=compute_rho(community, adj)
    rho_min=compute_rho_min(l)
    rho_max=compute_rho_max(l)
    if rho_max-rho_min==0:
        return 0.0
    return (rho-rho_min) / (rho_max-rho_min)


def compute_phi(community_nodes, adj):
    """
    Compute ϕ(C) = Σ_{u∈C} |inter_links(u)| / deg(u)
    Sum of each node's fraction of links going OUTSIDE the community.

    Args:
        community_nodes : set of node IDs in the target community
        adj             : dict {node: set of neighbors}

    Returns:
        float — ϕ(C)
    """
    # TODO: For each node u in C, count how many of its neighbors are outside C
    #       Then divide by deg(u) and sum over all u in C.
    pass


def compute_safeness(community_nodes, adj):
    """
    Compute σ(C) = 0.5 * ψ(C) + 0.5 * ϕ(C)

    Args:
        community_nodes : set of node IDs in the target community
        adj             : dict {node: set of neighbors}

    Returns:
        float — σ(C)
    """
    # TODO
    pass


# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def get_node_minimum_add_ratio(community_nodes, adj):
    """
    Find the node np ∈ C with the LOWEST ratio: |inter_links(u)| / deg(u).
    This is the node most isolated inside the community (Theorem 1).

    Args:
        community_nodes : set of node IDs in the target community
        adj             : dict {node: set of neighbors}

    Returns:
        int — node ID of np
    """
    # TODO
    pass


def find_random_external_node(np_node, community_nodes, adj, all_nodes):
    """
    Find a random external node nt such that:
      - nt is NOT in community_nodes
      - edge (np_node, nt) does NOT already exist

    Args:
        np_node         : int — the source node inside C
        community_nodes : set of node IDs in the target community
        adj             : dict {node: set of neighbors}
        all_nodes       : set of all node IDs in the graph

    Returns:
        int or None — node ID of nt, or None if no valid target found
    """
    # TODO
    pass


def get_addition_gain(np_node, nt_node, community_nodes, adj):
    """
    Compute safeness gain Φ_add if we add edge (np_node, nt_node).
    Uses the formula from Theorem 1 (equation 6 in paper):
        Φ_add = 0.5 * (deg(u) - |inter_links(u)|) / (deg(u) * (deg(u) + 1))

    Args:
        np_node         : int — node inside C
        nt_node         : int — node outside C
        community_nodes : set of node IDs in the target community
        adj             : dict {node: set of neighbors}

    Returns:
        float — Φ_add
    """
    # TODO
    pass


def is_bridge(u, v, community_nodes, adj):
    """
    Check if removing edge (u, v) would disconnect the community subgraph.
    Use BFS/DFS on community_nodes without the edge (u, v).

    Args:
        u, v            : int — the two endpoints of the edge to test
        community_nodes : set of node IDs in the target community
        adj             : dict {node: set of neighbors}

    Returns:
        bool — True if (u, v) is a bridge within C
    """
    # TODO: Remove (u,v) temporarily from the community subgraph and check
    #       if u can still reach v using only nodes in community_nodes.
    pass


def get_best_deletion(community_nodes, adj):
    """
    Find the intra-C edge (nk, nl) with the highest deletion gain Φ_del,
    excluding bridge edges (whose removal disconnects C).

    Args:
        community_nodes : set of node IDs in the target community
        adj             : dict {node: set of neighbors}

    Returns:
        tuple ((nk, nl), gain) — best edge and its gain, or (None, 0) if none
    """
    # TODO: Iterate over all intra-C edges, skip bridges,
    #       compute Φ_del = σ(C after deletion) - σ(C before deletion)
    #       Return the edge with the maximum gain.
    pass


def get_deletion_gain(nk, nl, community_nodes, adj):
    """
    Compute safeness gain Φ_del if we delete intra-C edge (nk, nl).
    σ(C') - σ(C) after removal of (nk, nl).

    Args:
        nk, nl          : int — endpoints of the intra-C edge
        community_nodes : set of node IDs in the target community
        adj             : dict {node: set of neighbors}

    Returns:
        float — Φ_del
    """
    # TODO: Temporarily remove the edge, compute σ(C'), restore edge, return gain.
    pass


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ALGORITHM
# ─────────────────────────────────────────────────────────────────────────────

def hs_algorithm(edges, community_nodes, budget):
    """
    Main Hs community hiding algorithm (Algorithm 1 from paper).

    Args:
        edges           : list of (u, v) tuples — current graph edges
        community_nodes : set of node IDs in the target community C
        budget          : int — maximum number of link perturbation operations

    Returns:
        list of (u, v) — updated edge list after hiding
    """
    # Build adjacency structure
    adj = build_adj(edges)
    all_nodes = set(n for edge in edges for n in edge)

    beta = budget

    while beta > 0:
        # Step 1: Find best node for addition (Theorem 1)
        np_node = get_node_minimum_add_ratio(community_nodes, adj)
        nt_node = find_random_external_node(np_node, community_nodes, adj, all_nodes)

        gain_add = 0.0
        if nt_node is not None:
            gain_add = get_addition_gain(np_node, nt_node, community_nodes, adj)

        # Step 2: Find best edge for deletion (Theorem 4)
        best_del_edge, gain_del = get_best_deletion(community_nodes, adj)

        # Step 3: Choose the better operation
        if gain_add >= gain_del and gain_add > 0:
            # ADD edge (np_node, nt_node)
            adj[np_node].add(nt_node)
            adj[nt_node].add(np_node)
        elif gain_del > 0 and best_del_edge is not None:
            # DELETE edge (nk, nl)
            nk, nl = best_del_edge
            adj[nk].discard(nl)
            adj[nl].discard(nk)
        else:
            # No beneficial operation available
            break

        beta -= 1

    # Reconstruct edge list from adjacency
    updated_edges = set()
    for u, neighbors in adj.items():
        for v in neighbors:
            updated_edges.add((min(u, v), max(u, v)))

    return list(updated_edges)


# ─────────────────────────────────────────────────────────────────────────────
# UTILITY
# ─────────────────────────────────────────────────────────────────────────────

def build_adj(edges):
    """Build an adjacency dict {node: set(neighbors)} from edge list."""
    adj = defaultdict(set)
    for u, v in edges:
        adj[u].add(v)
        adj[v].add(u)
    return adj


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT (for standalone testing)
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from utils import load_dataset

    dataset_name = "karate"   # change to any dataset folder name
    budget = 5

    edges, communities, info = load_dataset(dataset_name)
    print(f"Dataset : {info['name']}")
    print(f"Nodes   : {info['num_nodes']}")
    print(f"Edges   : {info['num_edges']}")

    # Pick target community (community ID 0 by default)
    target_comm_id = 0
    community_nodes = get_community_nodes(communities, target_comm_id)
    print(f"Target community size: {len(community_nodes)} nodes")

    updated_edges = hs_algorithm(edges, community_nodes, budget)
    print(f"Edges after hiding : {len(updated_edges)}")
