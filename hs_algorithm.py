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

def compute_phi(community, adj):
    phi=0.0
    for n in community:
        deg=len(adj[n])
        if deg==0: continue
        inter=0
        for neighbor in adj[n]:
            if neighbor not in community:
                inter+=1
        phi+=inter/deg
    return phi

def compute_safeness(community, adj):
    psi=compute_psi(community, adj)
    phi=compute_phi(community, adj)
    return 0.5*psi+0.5*phi

def get_node_minimum_add_ratio(community, adj):
    mini = float('inf')
    best = None
    for i in community:
        deg = len(adj[i])
        if deg==0:continue
        inter=0
        for k in adj[i]:
            if k not in community:
                inter+=1
        ratio = inter/deg
        if ratio<mini:
            mini=ratio
            best = i
    return best

def find_random_external_node(np_node, community_nodes, adj, all_nodes):
    candidates = list(all_nodes-community_nodes-adj[np_node]-{np_node})
    if not candidates:
        return None
    return random.choice(candidates)

def get_addition_gain(np_node, nt_node, community_nodes, adj):
    deg=len(adj[np_node])
    if deg==0: return 0.0
    inter=sum(1 for n in adj[np_node] if n not in community_nodes)
    return 0.5*(deg-inter)/((deg)*(deg+1))

def is_bridge(u, v, community_nodes, adj):
    adj[u].discard(v)
    adj[v].discard(u)
    visited={u}
    queue=deque([u])
    while queue:
        curr=queue.popleft()
        for n in adj[curr]:
            if n in community_nodes and n not in visited:
                visited.add(n)
                queue.append(n)
    is_bridge=v not in visited
    adj[u].add(v)
    adj[v].add(u)
    return is_bridge

def get_deletion_gain(nk, nl, community_nodes, adj):
    sigma_before=compute_safeness(community_nodes, adj)
    adj[nk].discard(nl)
    adj[nl].discard(nk)
    sigma_after=compute_safeness(community_nodes, adj)
    adj[nk].add(nl)
    adj[nl].add(nk)
    return sigma_after-sigma_before

def get_best_deletion(community_nodes, adj):
    best_edge=None
    best_gain=0.0
    seen=set()
    for u in community_nodes:
        for v in adj[u]:
            if v in community_nodes:
                edge=(min(u,v),max(u,v))
                if edge not in seen:
                    seen.add(edge)
                    if is_bridge(u,v,community_nodes,adj):continue
                    gain=get_deletion_gain(u,v,community_nodes,adj)
                    if gain>best_gain:
                        best_gain=gain
                        best_edge=(u,v)
    return best_edge,best_gain

def hs_algorithm(edges, community_nodes, budget):
    adj = build_adj(edges)
    all_nodes = set(n for edge in edges for n in edge)

    beta = budget

    while beta > 0:
        np_node=get_node_minimum_add_ratio(community_nodes, adj)
        nt_node=find_random_external_node(np_node, community_nodes, adj, all_nodes)
        gain_add = 0.0
        if nt_node is not None:
            gain_add = get_addition_gain(np_node, nt_node, community_nodes, adj)
        best_del_edge, gain_del = get_best_deletion(community_nodes, adj)
        if gain_add >= gain_del and gain_add > 0:
            adj[np_node].add(nt_node)
            adj[nt_node].add(np_node)
        elif gain_del > 0 and best_del_edge is not None:
            nk,nl=best_del_edge
            adj[nk].discard(nl)
            adj[nl].discard(nk)
        else:
            break
        beta -= 1
    updated_edges = set()
    for u, neighbors in adj.items():
        for v in neighbors:
            updated_edges.add((min(u, v), max(u, v)))
    return list(updated_edges)


def build_adj(edges):
    adj = defaultdict(set)
    for u, v in edges:
        adj[u].add(v)
        adj[v].add(u)
    return adj

if __name__ == "__main__":
    from utils import load_dataset

    dataset_name = "karate"   
    budget = 5

    edges, communities, info = load_dataset(dataset_name)
    print(f"Dataset : {info['name']}")
    print(f"Nodes   : {info['num_nodes']}")
    print(f"Edges   : {info['num_edges']}")

    target_comm_id = 0
    community_nodes = get_community_nodes(communities, target_comm_id)
    print(f"Target community size: {len(community_nodes)} nodes")

    updated_edges = hs_algorithm(edges, community_nodes, budget)
    print(f"Edges after hiding : {len(updated_edges)}")
