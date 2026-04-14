# Community Hiding via Link Perturbation

Implementation of the **Hs algorithm** and its extensions, based on the paper:

> **"Community Hiding by Link Perturbation in Social Networks"**
> Xianyu Chen, Zhongyuan Jiang, Hui Li, Jianfeng Ma, Philip S. Yu
> *IEEE Transactions on Computational Social Systems, Vol. 8, No. 3, June 2021*

---

## Project Structure

```
social_networks_java/
│
├── formatted_dataset/          ← All 9 datasets in uniform format
│   ├── karate/
│   │   ├── edges.txt           ← "u v" per line (0-indexed)
│   │   ├── communities.txt     ← "node_id community_id" per line
│   │   └── info.json           ← metadata (num_nodes, num_edges, ...)
│   ├── football/
│   ├── dolphin/
│   ├── facebook/
│   ├── erdos/
│   ├── astro-physics/
│   ├── co-authorship/
│   ├── powergrid/
│   └── uspoliticsbooks/
│
├── utils.py                    ← Shared helpers (load_dataset, build_graph, ...)
│
├── hs_algorithm.py             ← PERSON 1: Hs community hiding algorithm
├── evaluation.py               ← PERSON 2: Evaluation framework (Algorithm 2)
├── mhs_algorithm.py            ← PERSON 3: MHs multi-target future direction
│
├── main.py                     ← Entry point (optional — wire everything together)
└── formatted_dataset/
    └── convert_datasets.py     ← Script that generated the formatted datasets
```

---

## Datasets Available

| Dataset | Nodes | Edges | Communities | Ground Truth |
|---------|------:|------:|:-----------:|:------------:|
| karate | 34 | 78 | 2 | ✅ |
| football | 115 | 613 | 12 | ✅ |
| dolphin | 62 | 159 | — | No |
| uspoliticsbooks | 105 | 441 | — | No |
| co-authorship | 1,461 | 2,742 | — | No |
| powergrid | 4,941 | 6,594 | — | No |
| erdos | 5,094 | 7,515 | — | No |
| facebook | 4,039 | 88,234 | — | No |
| astro-physics | 16,046 | 121,251 | — | No |

---

## Shared Utilities (`utils.py`)

All three persons must import from `utils.py`. Do **not** copy-paste these functions.

```python
from utils import load_dataset, get_community_nodes, build_graph

edges, communities, info = load_dataset("karate")
target_nodes = get_community_nodes(communities, target_comm_id=0)
adj = build_graph(edges)
```

---

## 👤 Person 1 — `hs_algorithm.py`

### What you implement
The **Hs greedy community hiding algorithm** — Algorithm 1 from the paper (Section IV).

### Core idea
Each round, pick the single best link operation (add or delete) that maximally increases **community safeness σ(C)**, until budget β is exhausted.

### Key concepts

| Formula | Description |
|---------|-------------|
| `ρ(C)` | Sum of all pairwise shortest paths **within** community C |
| `ψ(C)` | Normalized intra-safeness = `(ρ(C) - ρ_min) / (ρ_max - ρ_min)` |
| `ϕ(C)` | Inter-safeness = `Σ_u |outside_links(u)| / deg(u)` |
| `σ(C)` | Total safeness = `0.5 * ψ(C) + 0.5 * ϕ(C)` |
| `Φ(C)` | Safeness gain = `σ(C') - σ(C)` after one operation |

### Rules (from paper theorems)
- ✅ **ADD** inter-C links (outside community) — always beneficial
- ✅ **DELETE** intra-C links (inside community) — always beneficial, if **not a bridge**
- ❌ **ADD** intra-C links — always harmful, never do this
- ❌ **DELETE** inter-C links — always harmful, never do this

### Functions to implement

| Function | Description |
|----------|-------------|
| `compute_rho()` | BFS-based sum of pairwise shortest paths inside C |
| `compute_rho_min(n)` | `2(n-1)²` |
| `compute_rho_max(n)` | Line graph formula |
| `compute_psi()` | Normalized intra-safeness |
| `compute_phi()` | Inter-safeness ratio |
| `compute_safeness()` | `0.5*ψ + 0.5*ϕ` |
| `get_node_minimum_add_ratio()` | Node with lowest outside-link ratio |
| `find_random_external_node()` | Pick valid target node outside C |
| `get_addition_gain()` | Equation 6 from paper |
| `is_bridge()` | Check if edge removal disconnects C |
| `get_best_deletion()` | Best non-bridge intra-C edge to remove |
| `get_deletion_gain()` | Compute gain for a deletion |
| `hs_algorithm()` | **Main function** — full Algorithm 1 |

### How to run
```bash
python hs_algorithm.py
```

---

## 👤 Person 2 — `evaluation.py`

### What you implement
The **evaluation framework** — Algorithm 2 from the paper (Section V-D and V-E).
This measures how well any hiding algorithm worked using 3 metrics.

### Core idea
Run a community detection algorithm on the graph **before** and **after** hiding, then compare Modularity, Safeness, and H-score.

### Key metrics

| Metric | Description |
|--------|-------------|
| **Modularity** `MG` | How well-clustered the graph is: `η/m - δ/(4m²)` |
| **Safeness** `σ(C)` | Imported from `hs_algorithm.py` — reuse as is |
| **H-score** `H` | Primary metric: 0 = detected, 1 = perfectly hidden |

### H-score formula
```
H = connectivity_factor × (0.5×(1 - max_recall) + 0.5×(1 - avg_precision))

where:
  max_recall   = max over all detected communities of |Ci ∩ C| / |C|
  avg_precision = mean of |Ci ∩ C| / |Ci| for communities overlapping C
  connectivity = 1 - (|S(C)| - 1) / (|C| - 1)
  |S(C)| = number of connected components in the C subgraph
```

### Community detection algorithms (use igraph)

| Code | Algorithm | igraph method |
|------|-----------|---------------|
| `LPA` | Label Propagation | `community_label_propagation()` |
| `IMP` | InfoMap | `community_infomap()` |
| `MLE` | MultiLevel / Louvain | `community_multilevel()` |
| `SGL` | SpinGlass | `community_spinglass()` |
| `LEI` | Leading Eigenvectors | `community_leading_eigenvector()` |

### Install igraph
```bash
pip install python-igraph
```

### Functions to implement

| Function | Description |
|----------|-------------|
| `run_community_detection()` | Run igraph detection, return `{node: comm_id}` dict |
| `compute_modularity()` | `η/m - δ/(4m²)` |
| `compute_connected_components()` | BFS count of components in C subgraph |
| `compute_recall()` | `R(Ci, C) = |Ci ∩ C| / |C|` per community |
| `compute_precision()` | `P(Ci, C) = |Ci ∩ C| / |Ci|` per community |
| `compute_h_score()` | Full H-score formula |
| `evaluate_hiding()` | **Main function** — full Algorithm 2 pipeline |

### How to run
```bash
python evaluation.py
```

---

## 👤 Person 3 — `mhs_algorithm.py`

### What you implement
The **MHs algorithm** — a future direction extension of Hs that hides **multiple target communities simultaneously** (mentioned in paper Section VI).

### Core idea
Instead of optimizing safeness for one community, optimize the **joint safeness** across all target communities. At each step, pick the single operation that gives the maximum total gain across all communities.

### Key concept: Joint Safeness
```
Σ_joint = Σ_i σ(Ci)   for all target communities Ci

Φ_joint(op) = Σ_joint AFTER operation - Σ_joint BEFORE operation
```

The algorithm picks `op = argmax Φ_joint(op)` at each step.

### Design considerations
- Budget β is **shared** across all target communities (one operation costs 1 from the total)
- The bridge check still applies **per community** — don't disconnect any target community
- An inter-C link addition for community Ca might also affect community Cb if the external node happens to be in Cb — handle this in the joint gain calculation
- Reuse `compute_safeness()`, `is_bridge()`, and other helpers from `hs_algorithm.py`

### Functions to implement

| Function | Description |
|----------|-------------|
| `compute_joint_safeness()` | Sum of σ(Ci) over all target communities |
| `compute_joint_gain()` | Gain across all communities for one proposed operation |
| `get_all_candidate_additions()` | All valid inter-C add candidates for every community |
| `get_all_candidate_deletions()` | All valid intra-C delete candidates (non-bridges) |
| `mhs_algorithm()` | **Main function** — full multi-target hiding loop |

### How to run
```bash
python mhs_algorithm.py
```

---

## Collaboration Rules

1. **Do NOT edit `utils.py`** unless all three agree — it is shared code.
2. **Person 2 depends on Person 1**: `evaluation.py` imports `compute_safeness()` and `build_adj()` from `hs_algorithm.py`. Person 1 must finish these functions first.
3. **Person 3 depends on Person 1**: `mhs_algorithm.py` imports many helpers from `hs_algorithm.py`. Coordinate with Person 1.
4. Each person only modifies their own file (`hs_algorithm.py`, `evaluation.py`, `mhs_algorithm.py`).
5. Use `karate` or `football` dataset for local testing (small and fast).

---

## Recommended Order of Work

```
Person 1 (Hs)         →  Person 2 (Evaluation)  →  Final comparison
     ↓
Person 3 (MHs)        →  Use Person 2's evaluator to test MHs
```

---

## Quick Start

```python
# Load any dataset
from utils import load_dataset, get_community_nodes

edges, communities, info = load_dataset("karate")
target_nodes = get_community_nodes(communities, target_comm_id=0)

# Person 1: Run hiding
from hs_algorithm import hs_algorithm
new_edges = hs_algorithm(edges, target_nodes, budget=5)

# Person 2: Evaluate the result
from evaluation import evaluate_hiding
results = evaluate_hiding(edges, 0, communities, budget=5,
                          hiding_fn=hs_algorithm, detection_algorithm='LPA')
print(results)
```
