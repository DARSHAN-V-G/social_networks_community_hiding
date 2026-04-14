"""
Shared utilities used by all three modules.
All persons should import from this file — do NOT duplicate these functions.
"""

import json
import os
from collections import defaultdict


def load_dataset(name, base="formatted_dataset"):
    """
    Load a formatted dataset by name.

    Args:
        name : str — folder name inside formatted_dataset/ (e.g. 'karate')
        base : str — path to formatted_dataset directory

    Returns:
        edges       : list of (u, v) tuples
        communities : dict {node_id: community_id}  (empty if no ground truth)
        info        : dict with name, num_nodes, num_edges, etc.
    """
    edges = []
    with open(os.path.join(base, name, "edges.txt")) as f:
        for line in f:
            line = line.strip()
            if line:
                u, v = map(int, line.split())
                edges.append((u, v))

    communities = {}
    comm_path = os.path.join(base, name, "communities.txt")
    if os.path.exists(comm_path):
        with open(comm_path) as f:
            for line in f:
                line = line.strip()
                if line:
                    node, comm = map(int, line.split())
                    communities[node] = comm

    with open(os.path.join(base, name, "info.json")) as f:
        info = json.load(f)

    return edges, communities, info


def build_graph(edges):
    """
    Build an adjacency dict {node: set(neighbors)} from an edge list.
    Same as build_adj in hs_algorithm.py — provided here for convenience.
    """
    adj = defaultdict(set)
    for u, v in edges:
        adj[u].add(v)
        adj[v].add(u)
    return adj


def get_community_nodes(communities, target_comm_id):
    """
    Return the set of node IDs belonging to target_comm_id.

    Args:
        communities    : dict {node_id: community_id}
        target_comm_id : int

    Returns:
        set of node IDs
    """
    return {node for node, cid in communities.items() if cid == target_comm_id}


def edges_to_adj(edges):
    """Alias for build_graph — returns adjacency dict."""
    return build_graph(edges)


def adj_to_edges(adj):
    """Convert adjacency dict back to a sorted edge list."""
    seen = set()
    edges = []
    for u, neighbors in adj.items():
        for v in neighbors:
            e = (min(u, v), max(u, v))
            if e not in seen:
                seen.add(e)
                edges.append(e)
    return sorted(edges)
