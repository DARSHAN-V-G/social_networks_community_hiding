// hsAlgorithm.js — Algorithm 1: Hs (Community Hiding via Safeness)
// Exact implementation of Algorithm 1 from:
//   Chen et al., "Community Hiding by Link Perturbation in Social Networks"
//   IEEE Transactions on Computational Social Systems, 2021
//
// Algorithm 1 pseudocode (paper):
//   Input:  G=(V,E), C, β
//   Output: G'
//   1: do
//   2:   np = getNodeMinimumAddRatio(C)            /* Theorem 1 */
//   3:   nt = findRandomExternalNode(np, C, G)
//   4:   Φ(C)_add ← getAdditionGain(np, nt, C)
//   5:   (nk,nl) = getBestDelExclBridges(C)        /* Theorem 4 */
//   6:   Φ(C)_del ← getDeletionGain(nk, nl, C)
//   7:   if Φ(C)_add >= Φ(C)_del and Φ(C)_add > 0 then
//   8:     G ← (V, E ∪ {(np,nt)})
//   9:   else if Φ(C)_del > 0 then
//  10:     G ← (V, E \ {(nk,nl)})
//  11:   β = β − 1,  G' = G
//  12: while β > 0 and (Φ(C)_add > 0 or Φ(C)_del > 0)

const { linksToAdj, computeSafeness, computePsi, computePhi, isBridge, computeHScore } = require('./safeness');
const { detectCommunities } = require('./communityDetection');


// ── Line 2 ────────────────────────────────────────────────────────────────────
// getNodeMinimumAddRatio(C):
//   For every node u ∈ C, compute ratio |Ẽ(u,C)| / deg(u)
//   (fraction of u's links that point outside C).
//   Return the node np with the MINIMUM ratio (most in need of external links).
function getNodeMinimumAddRatio(adj, commSet) {
  let minRatio = Infinity;
  let np = null;
  for (const u of commSet) {
    const d = adj[u].size;
    if (!d) continue;
    const interCount = [...adj[u]].filter(v => !commSet.has(v)).length;
    const ratio = interCount / d;
    if (ratio < minRatio) {
      minRatio = ratio;
      np = u;
    }
  }
  return np;
}


// ── Line 3 ────────────────────────────────────────────────────────────────────
// findRandomExternalNode(np, C, G):
//   Randomly find ONE node nt ∉ C such that edge (np, nt) does not already exist.
function findRandomExternalNode(np, commSet, adj, allIds) {
  const ext = allIds.filter(v => !commSet.has(v) && !adj[np].has(v) && v !== np);
  if (!ext.length) return null;
  return ext[Math.floor(Math.random() * ext.length)];
}


// ── Line 4 ────────────────────────────────────────────────────────────────────
// getAdditionGain(np, nt, C):
//   Compute addition gain per Theorem 1 proof (Eq. 6):
//     Φ(C)_add = ½ · (deg(np) − |Ẽ(np,C)|) / (deg(np) · (deg(np) + 1))
//   Note: ψ(C) is unaffected by inter-C additions (Theorem 1 proof),
//         so gain comes purely from the φ(C) term.
function getAdditionGain(np, adj, commSet) {
  const d = adj[np].size;
  if (!d) return 0;
  const interCount = [...adj[np]].filter(v => !commSet.has(v)).length;
  // Eq. 6 from paper
  return 0.5 * (d - interCount) / (d * (d + 1));
}


// ── Lines 5 & 6 ───────────────────────────────────────────────────────────────
// getBestDelExclBridges(C):
//   Step 1: Exclude any intra-C link whose deletion would disconnect C (bridges).
//   Step 2: For each remaining intra-C link, compute Φ(C) per Theorem 4.
//   Return the link (nk, nl) with the HIGHEST gain, and that gain value.
//
// getDeletionGain(nk, nl, C):
//   Embedded inside — Φ(C)_del = σ(C after deletion) − σ(C before deletion)
function getBestDelExclBridges(adj, commSet, links) {
  const intraLinks = links.filter(l => commSet.has(l.source) && commSet.has(l.target));
  const sigmaBefore = computeSafeness(adj, commSet);

  let nk = null, nl = null;
  let phi_del = 0;  // 0 means no valid deletion found

  for (const lk of intraLinks) {
    // Exclude bridges (deletion would disconnect C — violates reachability preservation)
    if (isBridge(adj, commSet, lk.source, lk.target)) continue;

    // getDeletionGain: temporarily remove edge from adj (O(1) Set mutation), measure, undo
    adj[lk.source].delete(lk.target);
    adj[lk.target].delete(lk.source);
    const gain = computeSafeness(adj, commSet) - sigmaBefore;  // Theorem 4: always > 0
    adj[lk.source].add(lk.target);
    adj[lk.target].add(lk.source);

    if (gain > phi_del) {
      phi_del = gain;
      nk = lk.source;
      nl = lk.target;
    }
  }

  return { nk, nl, phi_del };
}


// ── Main Algorithm 1 ──────────────────────────────────────────────────────────
function runHs(nodes, rawLinks, targetCommId, targetMembers, budget, detectionAlgo = 'louvain') {
  const allIds  = nodes.map(n => n.id);
  const commSet = new Set(targetMembers);
  let   links   = rawLinks.map(l => ({ source: +l.source, target: +l.target }));
  const steps   = [];

  // --- Initial state (before any perturbation) ---
  const initAdj  = linksToAdj(allIds, links);
  const initDet  = detectCommunities(nodes, links, detectionAlgo);
  const hBefore  = computeHScore(initDet.assignment, targetMembers, initAdj);
  const sigBefore = computeSafeness(initAdj, commSet);

  steps.push({
    step: 0, type: 'init',
    description: `Init: C${targetCommId} has ${targetMembers.length} nodes, σ=${sigBefore.toFixed(4)}`,
    sigma: { [targetCommId]: +sigBefore.toFixed(4) },
    mean_sigma: +sigBefore.toFixed(4),
    psi: +computePsi(initAdj, commSet).toFixed(4),
    phi: +computePhi(initAdj, commSet).toFixed(4),
    candidates: [], best: null, applied: null,
    added_links: [], removed_links: [],
    links: links.map(l => ({ source: l.source, target: l.target })),
    budget_remaining: budget
  });

  let b = 0;  // counts iterations used

  // Algorithm 1: do { ... } while (β > 0 AND (Φ_add > 0 OR Φ_del > 0))
  // Implemented as while(true) with manual break to avoid JS scoping issues with do-while.
  while (true) {
    const adj = linksToAdj(allIds, links);

    // Line 2: np = getNodeMinimumAddRatio(C)
    const np = getNodeMinimumAddRatio(adj, commSet);

    // Line 3: nt = findRandomExternalNode(np, C, G)
    const nt = (np !== null) ? findRandomExternalNode(np, commSet, adj, allIds) : null;

    // Line 4: Φ(C)_add = getAdditionGain(np, nt, C)
    const phi_add = (np !== null && nt !== null) ? getAdditionGain(np, adj, commSet) : 0;

    // Lines 5 & 6: (nk, nl) = getBestDelExclBridges(C)  →  Φ(C)_del = getDeletionGain(nk,nl,C)
    const { nk, nl, phi_del } = getBestDelExclBridges(adj, commSet, links);

    // Build candidate list for step explorer visualization
    const candidates = [];
    if (np !== null && nt !== null) {
      candidates.push({
        type: 'ADD', u: np, v: nt,
        delta: +phi_add.toFixed(6), penalty: 0, valid: true,
        reason: `inter-C ADD (${np}→${nt}) Φ=${phi_add.toFixed(4)}`
      });
    }
    if (nk !== null) {
      candidates.push({
        type: 'DEL', u: nk, v: nl,
        delta: +phi_del.toFixed(6), penalty: 0, valid: true,
        reason: `intra-C DEL (${nk}–${nl}) Φ=${phi_del.toFixed(4)}`
      });
    }

    const curSig   = computeSafeness(adj, commSet);
    const addedL   = [];
    const removedL = [];
    let applied    = null;

    // Lines 7–10: apply the best operation
    if (phi_add >= phi_del && phi_add > 0) {
      // Line 8: G ← (V, E ∪ {(np, nt)})
      links.push({ source: np, target: nt });
      addedL.push({ source: np, target: nt });
      applied = {
        type: 'ADD', u: np, v: nt,
        target_comm: targetCommId,
        delta_phi: +phi_add.toFixed(6),
        mean_gain: +phi_add.toFixed(6),
        penalty: 0
      };
    } else if (phi_del > 0) {
      // Line 10: G ← (V, E \ {(nk, nl)})
      links = links.filter(l =>
        !((l.source === nk && l.target === nl) ||
          (l.source === nl && l.target === nk))
      );
      removedL.push({ source: nk, target: nl });
      applied = {
        type: 'DEL', u: nk, v: nl,
        target_comm: targetCommId,
        delta_phi: +phi_del.toFixed(6),
        mean_gain: +phi_del.toFixed(6),
        penalty: 0
      };
    }

    // Line 11: β = β − 1,  G' = G
    b++;
    const newAdj = linksToAdj(allIds, links);
    const newSig = computeSafeness(newAdj, commSet);

    if (applied) {
      steps.push({
        step: b,
        type: applied.type === 'ADD' ? 'add' : 'delete',
        description: `β=${b}: ${applied.type} (${applied.u}↔${applied.v}) Φ=${applied.delta_phi}`,
        sigma: { [targetCommId]: +newSig.toFixed(4) },
        mean_sigma: +newSig.toFixed(4),
        psi: +computePsi(newAdj, commSet).toFixed(4),
        phi: +computePhi(newAdj, commSet).toFixed(4),
        candidates,
        best: candidates.find(c => c.type === applied.type && c.u === applied.u) || null,
        applied,
        added_links: addedL,
        removed_links: removedL,
        links: links.map(l => ({ source: l.source, target: l.target })),
        budget_remaining: budget - b
      });
    } else {
      // Both gains ≤ 0 — no operation was applied, stop early
      steps.push({
        step: b, type: 'stop',
        description: `No improving operation at β=${b}. Stopped early.`,
        sigma: { [targetCommId]: +curSig.toFixed(4) },
        mean_sigma: +curSig.toFixed(4),
        psi: +computePsi(adj, commSet).toFixed(4),
        phi: +computePhi(adj, commSet).toFixed(4),
        candidates, best: null, applied: null,
        added_links: [], removed_links: [],
        links: links.map(l => ({ source: l.source, target: l.target })),
        budget_remaining: budget - b
      });
      break;
    }

    // Line 12: while β > 0 and (Φ(C)_add > 0 or Φ(C)_del > 0)
    if (b >= budget || (phi_add <= 0 && phi_del <= 0)) break;
  }

  // --- Final state (after all perturbations) ---
  const finalAdj = linksToAdj(allIds, links);
  const sigAfter = computeSafeness(finalAdj, commSet);
  const finalDet = detectCommunities(nodes, links, detectionAlgo);
  const hAfter   = computeHScore(finalDet.assignment, targetMembers, finalAdj);

  return {
    algorithm: 'Hs',
    target_communities: [targetCommId],
    budget,
    steps,
    summary: {
      sigma_before:      { [targetCommId]: +sigBefore.toFixed(4) },
      sigma_after:       { [targetCommId]: +sigAfter.toFixed(4) },
      mean_sigma_before: +sigBefore.toFixed(4),
      mean_sigma_after:  +sigAfter.toFixed(4),
      h_scores_before:   { [targetCommId]: +hBefore.toFixed(4) },
      h_scores:          { [targetCommId]: +hAfter.toFixed(4) },
      combined_h_score:  +hAfter.toFixed(4),
      total_perturbations: steps.filter(s => s.applied).length,
      final_links:       links,
      final_communities: finalDet
    }
  };
}

module.exports = { runHs };
