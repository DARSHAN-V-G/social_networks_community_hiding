// hsAlgorithm.js — Single-target Hs (Chen et al. 2021)
const { linksToAdj, computeSafeness, computePsi, computePhi, isBridge, computeHScore } = require('./safeness');
const { detectCommunities } = require('./communityDetection');

function runHs(nodes, rawLinks, targetCommId, targetMembers, budget, detectionAlgo='louvain') {
  const allIds = nodes.map(n=>n.id);
  const commSet = new Set(targetMembers);
  let links = rawLinks.map(l=>({ source: +l.source, target: +l.target }));
  const steps = [];

  const initAdj = linksToAdj(allIds, links);
  const initDet = detectCommunities(nodes, links, detectionAlgo);
  const hBefore = computeHScore(initDet.assignment, targetMembers, initAdj);
  const sigBefore = computeSafeness(initAdj, commSet);

  steps.push({ step:0, type:'init',
    description:`Init: C${targetCommId} has ${targetMembers.length} nodes, σ=${sigBefore.toFixed(4)}`,
    sigma:{[targetCommId]: +sigBefore.toFixed(4)},
    mean_sigma: +sigBefore.toFixed(4),
    psi: +computePsi(initAdj,commSet).toFixed(4),
    phi: +computePhi(initAdj,commSet).toFixed(4),
    candidates:[], best:null, applied:null, added_links:[], removed_links:[],
    links: links.map(l=>({source:l.source,target:l.target})), budget_remaining:budget });

  for (let b=0; b<budget; b++) {
    const adj = linksToAdj(allIds, links);
    const candidates = [];

    // inter-C ADD
    let minR=Infinity, np=null;
    for (const u of commSet) {
      const d=adj[u].size; if(!d) continue;
      const inter=[...adj[u]].filter(v=>!commSet.has(v)).length;
      const r=inter/d; if(r<minR){minR=r;np=u;}
    }
    if (np!==null) {
      const ext = allIds.filter(v=>!commSet.has(v)&&!adj[np].has(v)&&v!==np);
      for (const nt of ext) {  // all valid external nodes — no artificial cap
        const d=adj[np].size;
        const inter=[...adj[np]].filter(v=>!commSet.has(v)).length;
        const gain = d>0 ? 0.5*(d-inter)/(d*(d+1)) : 0;
        candidates.push({ type:'ADD', u:np, v:nt, delta:+gain.toFixed(6), penalty:0, valid:true,
          reason:`inter-C ADD (${np}→${nt})` });
      }
    }

    // intra-C DELETE
    const intra = links.filter(l=>commSet.has(l.source)&&commSet.has(l.target));
    for (const lk of intra) {
      if (isBridge(adj,commSet,lk.source,lk.target)) {
        candidates.push({ type:'DEL', u:lk.source, v:lk.target, delta:0, penalty:0, valid:false,
          reason:`intra-C DEL (${lk.source}–${lk.target}) SKIP — bridge` }); continue;
      }
      const tl = links.filter(l=>!(l.source===lk.source&&l.target===lk.target)&&!(l.source===lk.target&&l.target===lk.source));
      const ta = linksToAdj(allIds, tl);
      const gain = computeSafeness(ta,commSet) - computeSafeness(adj,commSet);
      candidates.push({ type:'DEL', u:lk.source, v:lk.target, delta:+gain.toFixed(6), penalty:0, valid:true,
        reason:`intra-C DEL (${lk.source}–${lk.target}) Δ=${gain.toFixed(4)}` });
    }

    const valid = candidates.filter(c=>c.valid).sort((a,b)=>b.delta-a.delta);
    const best = valid[0]||null;
    const allSorted = [...valid, ...candidates.filter(c=>!c.valid)];
    const curSig = computeSafeness(adj, commSet);

    if (!best || best.delta<=0) {
      steps.push({ step:b+1, type:'stop',
        description:`No improving operation at β=${b+1}. Stopped early.`,
        sigma:{[targetCommId]:+curSig.toFixed(4)}, mean_sigma:+curSig.toFixed(4),
        psi:+computePsi(adj,commSet).toFixed(4), phi:+computePhi(adj,commSet).toFixed(4),
        candidates:allSorted, best:null, applied:null, added_links:[], removed_links:[],
        links:links.map(l=>({source:l.source,target:l.target})), budget_remaining:budget-b });
      break;
    }

    const addedL=[], removedL=[];
    if (best.type==='ADD') { links.push({source:best.u,target:best.v}); addedL.push({source:best.u,target:best.v}); }
    else { links=links.filter(l=>!((l.source===best.u&&l.target===best.v)||(l.source===best.v&&l.target===best.u))); removedL.push({source:best.u,target:best.v}); }

    const newAdj=linksToAdj(allIds,links);
    const newSig=computeSafeness(newAdj,commSet);
    steps.push({ step:b+1, type:best.type==='ADD'?'add':'delete',
      description:`β=${b+1}: ${best.type} (${best.u}↔${best.v}) ΔΦ=${best.delta.toFixed(4)}`,
      sigma:{[targetCommId]:+newSig.toFixed(4)}, mean_sigma:+newSig.toFixed(4),
      psi:+computePsi(newAdj,commSet).toFixed(4), phi:+computePhi(newAdj,commSet).toFixed(4),
      candidates:allSorted, best, applied:{type:best.type,u:best.u,v:best.v,target_comm:targetCommId,delta_phi:best.delta,mean_gain:best.delta,penalty:0},
      added_links:addedL, removed_links:removedL,
      links:links.map(l=>({source:l.source,target:l.target})), budget_remaining:budget-b-1 });
  }

  const finalAdj=linksToAdj(allIds,links);
  const sigAfter=computeSafeness(finalAdj,commSet);
  const finalDet=detectCommunities(nodes,links,detectionAlgo);
  const hAfter=computeHScore(finalDet.assignment,targetMembers,finalAdj);

  return { algorithm:'Hs', target_communities:[targetCommId], budget, steps,
    summary:{ sigma_before:{[targetCommId]:+sigBefore.toFixed(4)}, sigma_after:{[targetCommId]:+sigAfter.toFixed(4)},
      mean_sigma_before:+sigBefore.toFixed(4), mean_sigma_after:+sigAfter.toFixed(4),
      h_scores_before:{[targetCommId]:+hBefore.toFixed(4)},
      h_scores:{[targetCommId]:+hAfter.toFixed(4)}, combined_h_score:+hAfter.toFixed(4),
      total_perturbations:steps.filter(s=>s.applied).length, final_links:links, final_communities:finalDet } };
}

module.exports = { runHs };
