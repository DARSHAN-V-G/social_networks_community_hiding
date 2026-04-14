import json

def load_dataset(name, base="formatted_dataset"):
    edges = []
    with open(f"{base}/{name}/edges.txt") as f:
        for line in f:
            u, v = map(int, line.split())
            edges.append((u, v))
    
    communities = {}
    try:
        with open(f"{base}/{name}/communities.txt") as f:
            for line in f:
                node, comm = map(int, line.split())
                communities[node] = comm
    except FileNotFoundError:
        pass
    
    with open(f"{base}/{name}/info.json") as f:
        info = json.load(f)
    
    return edges, communities, info
