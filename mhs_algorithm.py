"""
=============================================================================
  PERSON 3 — MHs Algorithm: Multiple Target Community Hiding (Future Direction)
=============================================================================

TASK:
    Implement an extended version of the Hs algorithm that can hide MULTIPLE
    target communities simultaneously — referred to here as "MHs".

    This is the "future direction" mentioned in the paper's conclusion:
    "multiple target communities deception problem" (Section VI, page 714).

    The paper only proposes Hs for a SINGLE community. Your job is to:
    1. Extend the safeness framework to handle multiple communities
    2. Design a strategy to jointly optimize hiding across all targets
    3. Avoid fixing one community at the cost of exposing another

YOUR JOB:
    Complete every function marked with  # TODO  below.

INPUTS (provided via main.py / load_dataset):
    - edges            : list of (u, v) tuples — undirected graph edges (0-indexed)
    - communities      : dict {node_id: community_id} — ground-truth community labels
    - target_comm_ids  : list of int — IDs of ALL communities you want to hide
    - budget β         : int — total link perturbation budget shared across all targets

OUTPUT:
    - updated edges list after hiding all target communities

DESIGN APPROACH (suggested — you may deviate if you have a better idea):

    Strategy: "Joint Greedy with Cross-Community Gain"
    ─────────────────────────────────────────────────
    Instead of hiding one community at a time, at each step:
    1. For EACH target community Ci, compute the possible addition and
       deletion gains (same as Hs for single community).
    2. Pick the single operation across ALL communities that gives the
       maximum total safeness gain: Φ_joint = Σ_i σ(Ci')
    3. Apply that operation, update budget, repeat.

    The key challenge: adding a link between communities Ca and Cb
    benefits Ca (inter-C addition for Ca) but might also benefit Cb
    if the linked node is in Cb — you must handle this carefully.

EXTENDED FORMULA:
    Joint safeness:
        Σ_joint(all targets) = Σ_{i} σ(Ci)

    Joint gain from one operation:
        Φ_joint(op) = Σ_joint AFTER op - Σ_joint BEFORE op

    The greedy step picks op = argmax Φ_joint(op).

NOTES:
    - You may import and reuse compute_safeness(), build_adj(), and
      other helpers from hs_algorithm.py
    - The is_bridge() check still applies per-community: you cannot delete
      a link that disconnects any target community
    - Budget β is shared — a single operation on any community costs 1

REFERENCES:
    Paper Section VI (Conclusion / Future Work), page 714
    Base algorithm: Paper Section IV, Algorithm 1
=============================================================================
"""

from collections import defaultdict
from hs_algorithm import (
    compute_safeness, compute_psi, compute_phi,
    get_node_minimum_add_ratio, find_random_external_node,
    get_addition_gain, is_bridge, build_adj
)
from utils import load_dataset, get_community_nodes


# ─────────────────────────────────────────────────────────────────────────────
# JOINT METRIC FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def compute_joint_safeness(all_target_nodes, adj):
    """
    Compute the joint safeness across all target communities.
    Σ_joint = Σ_{i} σ(Ci)

    Args:
        all_target_nodes : list of sets — each set is the nodes of one target community
        adj              : dict {node: set of neighbors}

    Returns:
        float — sum of σ(Ci) over all target communities
    """
    # TODO: Call compute_safeness for each community and sum the results.
    pass


def compute_joint_gain(op_type, u, v, all_target_nodes, adj):
    """
    Compute the joint safeness gain for a proposed operation.

    Args:
        op_type          : str — 'add' or 'delete'
        u, v             : int — the two endpoints of the proposed edge
        all_target_nodes : list of sets — nodes of each target community
        adj              : dict {node: set of neighbors}

    Returns:
        float — Φ_joint gain (positive = beneficial overall)
    """
    # TODO:
    # 1. Compute current joint safeness
    # 2. Temporarily apply the operation (add or delete edge u-v in adj)
    # 3. Compute new joint safeness
    # 4. Undo the operation
    # 5. Return (new joint safeness - old joint safeness)
    pass


# ─────────────────────────────────────────────────────────────────────────────
# CANDIDATE OPERATION GENERATORS
# ─────────────────────────────────────────────────────────────────────────────

def get_all_candidate_additions(all_target_nodes, adj, all_nodes):
    """
    Generate all candidate inter-C link addition operations across all
    target communities.

    For each community Ci:
      - Find np = node in Ci with lowest inter-link ratio
      - Find valid external node nt (not in Ci, not already linked to np)
      - Yield (np, nt, community_index)

    Args:
        all_target_nodes : list of sets
        adj              : dict {node: set of neighbors}
        all_nodes        : set of all node IDs

    Returns:
        list of (np, nt, community_index) tuples
    """
    # TODO
    pass


def get_all_candidate_deletions(all_target_nodes, adj):
    """
    Generate all candidate intra-C link deletion operations across all
    target communities (excluding bridges).

    For each community Ci:
      - Find all non-bridge intra-C edges
      - Yield (nk, nl, community_index)

    Args:
        all_target_nodes : list of sets
        adj              : dict {node: set of neighbors}

    Returns:
        list of (nk, nl, community_index) tuples
    """
    # TODO
    pass


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ALGORITHM
# ─────────────────────────────────────────────────────────────────────────────

def mhs_algorithm(edges, all_target_nodes, budget):
    """
    MHs — Multiple Target Community Hiding Algorithm.
    Extends Hs to hide multiple communities jointly.

    Args:
        edges            : list of (u, v) tuples — current graph edges
        all_target_nodes : list of sets — each set is one target community's nodes
        budget           : int — total number of perturbation operations allowed

    Returns:
        list of (u, v) — updated edge list after hiding all target communities
    """
    adj = build_adj(edges)
    all_nodes = set(n for edge in edges for n in edge)
    beta = budget

    while beta > 0:
        best_gain = 0.0
        best_op   = None   # ('add', u, v) or ('delete', u, v)

        # ── Evaluate all candidate additions ─────────────────────────────────
        candidates_add = get_all_candidate_additions(all_target_nodes, adj, all_nodes)
        for np_node, nt_node, _ in candidates_add:
            gain = compute_joint_gain('add', np_node, nt_node, all_target_nodes, adj)
            if gain > best_gain:
                best_gain = gain
                best_op   = ('add', np_node, nt_node)

        # ── Evaluate all candidate deletions ─────────────────────────────────
        candidates_del = get_all_candidate_deletions(all_target_nodes, adj)
        for nk, nl, _ in candidates_del:
            gain = compute_joint_gain('delete', nk, nl, all_target_nodes, adj)
            if gain > best_gain:
                best_gain = gain
                best_op   = ('delete', nk, nl)

        # ── Apply the best operation ──────────────────────────────────────────
        if best_op is None or best_gain <= 0:
            break   # No beneficial move left

        op_type, u, v = best_op
        if op_type == 'add':
            adj[u].add(v)
            adj[v].add(u)
        else:
            adj[u].discard(v)
            adj[v].discard(u)

        beta -= 1

    # Reconstruct edge list
    updated_edges = set()
    for u, neighbors in adj.items():
        for v in neighbors:
            updated_edges.add((min(u, v), max(u, v)))

    return list(updated_edges)


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT (for standalone testing)
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from utils import load_dataset

    dataset_name    = "football"   # change to any dataset with communities
    target_comm_ids = [0, 1]       # hide communities 0 and 1 simultaneously
    budget          = 10

    edges, communities, info = load_dataset(dataset_name)
    print(f"Dataset : {info['name']}  |  Nodes: {info['num_nodes']}  |  Edges: {info['num_edges']}")

    all_target_nodes = [get_community_nodes(communities, cid) for cid in target_comm_ids]
    print(f"Hiding {len(all_target_nodes)} communities: sizes = {[len(s) for s in all_target_nodes]}")

    updated_edges = mhs_algorithm(edges, all_target_nodes, budget)
    print(f"Edges after hiding: {len(updated_edges)}")
