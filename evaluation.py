from collections import defaultdict
from hs_algorithm import compute_safeness, build_adj
from utils import load_dataset, get_community_nodes

def run_community_detection(edges, all_nodes, algorithm='LPA'):
    import igraph as ig
    g = ig.Graph()
    g.add_vertices(list(all_nodes))
    g.add_edges(edges)
    if algorithm == 'LPA':
        comm = g.community_label_propagation()
    elif algorithm == 'IMP':
        comm = g.community_infomap()
    elif algorithm == 'MLE':
        comm = g.community_multilevel()
    elif algorithm == 'SGL':
        comm = g.community_spinglass()
    else:
        comm = g.community_leading_eigenvector()
    res = {}
    mem = comm.membership
    for i in range(len(mem)):
        res[i] = mem[i]
    return res

def compute_modularity(edges, detected_communities):
    m = len(edges)
    eta = 0
    deg = {}
    for u,v in edges:
        if u not in deg:
            deg[u]=0
        if v not in deg:
            deg[v]=0
        deg[u]+=1
        deg[v]+=1
        if detected_communities[u] == detected_communities[v]:
            eta += 1
    comm_nodes = {}
    for node in detected_communities:
        cid = detected_communities[node]
        if cid not in comm_nodes:
            comm_nodes[cid]=[]
        comm_nodes[cid].append(node)
    delta = 0
    for cid in comm_nodes:
        s = 0
        for node in comm_nodes[cid]:
            s += deg.get(node,0)
        delta += s*s
    return (eta/m) - (delta/(4*m*m))

def compute_connected_components(community_nodes, adj):
    visited = set()
    count = 0
    for node in community_nodes:
        if node not in visited:
            count += 1
            stack = [node]
            visited.add(node)
            while stack:
                x = stack.pop()
                for nei in adj.get(x,[]):
                    if nei in community_nodes and nei not in visited:
                        visited.add(nei)
                        stack.append(nei)
    return count

def compute_recall(detected_communities, target_nodes):
    comm_nodes = {}
    for node in detected_communities:
        cid = detected_communities[node]
        if cid not in comm_nodes:
            comm_nodes[cid]=[]
        comm_nodes[cid].append(node)
    res = {}
    n = len(target_nodes)
    for cid in comm_nodes:
        inter = 0
        for node in comm_nodes[cid]:
            if node in target_nodes:
                inter += 1
        if inter > 0:
            res[cid] = inter / n
    return res

def compute_precision(detected_communities, target_nodes):
    comm_nodes = {}
    for node in detected_communities:
        cid = detected_communities[node]
        if cid not in comm_nodes:
            comm_nodes[cid]=[]
        comm_nodes[cid].append(node)
    res = {}
    for cid in comm_nodes:
        inter = 0
        for node in comm_nodes[cid]:
            if node in target_nodes:
                inter += 1
        if inter > 0:
            res[cid] = inter / len(comm_nodes[cid])
    return res

def compute_h_score(target_nodes, detected_communities, adj):
    n = len(target_nodes)
    S = compute_connected_components(target_nodes, adj)
    if n <= 1:
        return 0
    else:
        connectivity = 1 - (S - 1)/(n - 1)
    recalls = compute_recall(detected_communities, target_nodes)
    precisions = compute_precision(detected_communities, target_nodes)
    max_recall = 0
    for k in recalls:
        if recalls[k] > max_recall:
            max_recall = recalls[k]
    if len(precisions)==0:
        avg_precision = 0
    else:
        s = 0
        c = 0
        for k in precisions:
            s += precisions[k]
            c += 1
        avg_precision = s/c
    return connectivity * (0.5*(1-max_recall) + 0.5*(1-avg_precision))

def evaluate_hiding(edges, target_comm_id, communities_gt, budget,
                    hiding_fn, detection_algorithm='LPA'):
    all_nodes = set(n for edge in edges for n in edge)
    target_nodes = get_community_nodes(communities_gt, target_comm_id)
    detected_before = run_community_detection(edges, all_nodes, detection_algorithm)
    adj_before = build_adj(edges)
    mod_before  = compute_modularity(edges, detected_before)
    safe_before = compute_safeness(target_nodes, adj_before)
    h_before    = compute_h_score(target_nodes, detected_before, adj_before)
    new_edges = hiding_fn(edges, target_nodes, budget)
    detected_after = run_community_detection(new_edges, all_nodes, detection_algorithm)
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

if __name__ == "__main__":
    from hs_algorithm import hs_algorithm
    dataset_name="karate"
    target_comm_id=0
    budget=5
    detection_algo="LPA"
    edges, communities, info = load_dataset(dataset_name)
    print(f"Dataset : {info['name']}  |  Nodes: {info['num_nodes']}  |  Edges: {info['num_edges']}")
    results = evaluate_hiding(edges, target_comm_id, communities, budget, hs_algorithm, detection_algo)
    print(f"\n{'Metric':<15} {'Before':>10} {'After':>10}")
    print("-"*38)
    for metric in ['modularity','safeness','h_score']:
        b=results['before'][metric]
        a=results['after'][metric]
        print(f"{metric:<15} {b:>10.4f} {a:>10.4f}")