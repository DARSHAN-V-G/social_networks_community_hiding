# Community Privacy Lab

This project implements two community-hiding algorithms based on link perturbation. Both algorithms iteratively add or remove edges to reduce how easily target communities can be detected.

## Single-community hiding (Hs)

**Goal:** hide one target community by improving its safeness score $\sigma$ with a limited perturbation budget $\beta$.

**Algorithm (Hs):**
1. Build the graph adjacency and compute initial safeness $\sigma$ for the target community.
2. For each budget step $b = 1..\beta$:
   - Generate candidate operations:
     - **ADD (inter-community):** add an edge from a target node to a non-target node, prioritizing target nodes with the lowest inter-community ratio.
     - **DEL (intra-community):** remove a non-bridge edge within the target community.
   - Score each candidate by the estimated improvement in $\sigma$.
   - Apply the best positive-gain operation; stop early if no positive gain exists.
3. Run community detection again on the modified graph to measure how the target is now detected.

**Inputs:**
- Graph (nodes, links)
- Target community members
- Budget $\beta$
- Detection algorithm (Louvain or LPA)

**Outputs:**
- Perturbation steps (added/removed edges)
- Updated graph
- Final community detection assignment
- H-score summary for the target

## Multi-community hiding (MHs-Joint)

**Goal:** hide multiple target communities simultaneously by maximizing their mean safeness while penalizing harmful interactions between targets.

**Algorithm (MHs-Joint):**
1. Build the graph adjacency and compute initial $\sigma$ for each target community.
2. For each budget step $b = 1..\beta$:
   - Generate candidate operations for each target:
     - **ADD (inter-community):** add edges from each target to non-target nodes.
     - **DEL (intra-community):** remove non-bridge edges within each target.
   - Compute gain as mean improvement in $\sigma$ minus an inter-target penalty $\lambda$ when adding edges that connect different target communities.
   - Apply the best positive-gain operation; stop early if no positive gain exists.
3. Run community detection again on the modified graph to measure the new assignments.

**Inputs:**
- Graph (nodes, links)
- Multiple target communities
- Budget $\beta$
- Penalty $\lambda$
- Detection algorithm (Louvain or LPA)

**Outputs:**
- Perturbation steps (added/removed edges)
- Updated graph
- Final community detection assignment
- Per-target and combined H-score summary

## Notes
- Both algorithms avoid removing bridge edges to keep the target subgraph connected.
- The backend recomputes community detection after perturbations to report the post-hiding result.
- Implementation files:
  - Single: `backend/hsAlgorithm.js`
  - Multi: `backend/mhsAlgorithm.js`
