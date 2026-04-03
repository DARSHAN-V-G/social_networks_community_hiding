# Social and Economic Network analysis

This project implements two community-hiding algorithms based on link perturbation. Both algorithms iteratively add or remove edges to reduce how easily target communities can be detected.

## Single-community hiding (Hs)

**Goal:** hide one target community by improving its safeness score $\sigma$ with a limited perturbation budget $\beta$.

**Key formulas (as implemented):**
- Candidate evaluation uses the change in safeness:
  $$\Delta\sigma = \sigma(A') - \sigma(A)$$
  where $A'$ is the adjacency after a single edge add/remove.
  Plain text: Delta sigma = sigma(A') - sigma(A)
- For **ADD** candidates, the estimated gain uses target node degree $d$ and its external neighbors $\text{inter}$:
  $$\Delta\sigma_{\text{ADD}} \approx \frac{1}{2}\cdot\frac{d-\text{inter}}{d(d+1)}$$
  Plain text: Delta sigma_ADD ~= 0.5 * (d - inter) / (d * (d + 1))

**Algorithm (Hs, matching code):**
1. Build adjacency and compute initial $\sigma(C)$.
2. For each budget step $b = 1..\beta$:
   - **Generate ADD candidates:**
     - Pick a target node $u \in C$ minimizing $r(u)=\frac{\text{inter}(u)}{\deg(u)}$.
     - For up to 20 external nodes $v \notin C$ not connected to $u$, add candidate edges $(u,v)$ with the estimated gain above.
   - **Generate DEL candidates:**
     - For each intra-community edge $(u,v)$, skip if it is a bridge.
     - Otherwise compute exact $\Delta\sigma$ after removing $(u,v)$.
   - Choose the highest positive-gain candidate; stop early if none improves $\sigma$.
3. Run community detection again on the perturbed graph.

**Example (Hs):**
- Suppose a target node $u$ has $\deg(u)=6$ and $\text{inter}(u)=2$.
- The estimated ADD gain is:
  $$\Delta\sigma_{\text{ADD}} \approx \frac{1}{2}\cdot\frac{6-2}{6\cdot7} = \frac{1}{2}\cdot\frac{4}{42} \approx 0.0476$$
- If no DEL candidate yields a larger positive gain, the algorithm adds $(u,v)$.

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

**Key formulas (as implemented):**
- Mean safeness:
  $$\bar{\sigma} = \frac{1}{k}\sum_{i=1}^{k} \sigma(C_i)$$
  Plain text: sigma_bar = (1/k) * sum_{i=1..k} sigma(C_i)
- For a candidate affecting target $C_i$:
  $$\text{meanGain} = \frac{\Delta\sigma_i}{k}$$
  Plain text: meanGain = Delta sigma_i / k
- Penalty when an ADD connects different targets:
  $$\text{penalty} = \frac{\lambda}{\max(1,k-1)}$$
  Plain text: penalty = lambda / max(1, k - 1)
- Final score used for ranking:
  $$\Delta\Phi = \text{meanGain} - \text{penalty}$$
  Plain text: Delta Phi = meanGain - penalty

**Algorithm (MHs-Joint, matching code):**
1. Build adjacency and compute $\sigma(C_i)$ for each target; compute initial $\bar{\sigma}$.
2. For each budget step $b = 1..\beta$:
   - **Generate ADD candidates for each target $C_i$:**
     - Choose $u \in C_i$ minimizing $r(u)=\frac{\text{inter}(u)}{\deg(u)}$.
     - For up to 15 external nodes $v \notin C_i$ not connected to $u$, compute $\Delta\Phi$.
     - If $v$ is in a different target, apply the penalty term.
   - **Generate DEL candidates for each target $C_i$:**
     - For each intra-community edge $(u,v)$, skip if it is a bridge.
     - Otherwise compute $\Delta\sigma_i$ and set $\Delta\Phi=\Delta\sigma_i/k$.
   - Choose the highest positive $\Delta\Phi$; stop early if none improves the objective.
3. Run community detection again on the perturbed graph.

**Example (MHs-Joint):**
- Let $k=2$, $\lambda=0.5$, and a candidate improves target $C_1$ by $\Delta\sigma_1=0.08$.
- The mean gain is $0.08/2=0.04$.
- If the added edge connects to the other target, penalty is $0.5/(2-1)=0.5$.
- The score is $\Delta\Phi=0.04-0.5=-0.46$, so the candidate is rejected.

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
