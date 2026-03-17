// mhsAlgorithm.js — Multi-target MHs-Joint algorithm
const { linksToAdj, computeSafeness, computePsi, computePhi, isBridge, computeHScore } = require('./safeness');
const { detectCommunities } = require('./communityDetection');

function runMHs(nodes, rawLinks, targets, budget, lambda=0.5, detectionAlgo='louvain') {
  const allIds = nodes.map(n=>n.id);
  const tSets = targets.map(t=>new Set(t.members));
  const tAll = new Set(targets.flatMap(t=>t.members));
  const k = targets.length;
  let links = rawLinks.map(l=>({source:+l.source,target:+l.target}));
  const steps = [];

  const initAdj = linksToAdj(allIds, links);
  const initSigmas = {};
  targets.forEach((t,i)=>initSigmas[t.commId]=+computeSafeness(initAdj,tSets[i]).toFixed(4));
  const initMean = +(Object.values(initSigmas).reduce((a,b)=>a+b,0)/k).toFixed(4);

  steps.push({ step:0, type:'init',
    description:`Init: ${k} targets, β=${budget}, λ=${lambda}`,
    sigma:{...initSigmas}, mean_sigma:initMean,
    psi:Object.fromEntries(targets.map((t,i)=>[t.commId,+computePsi(initAdj,tSets[i]).toFixed(4)])),
    phi:Object.fromEntries(targets.map((t,i)=>[t.commId,+computePhi(initAdj,tSets[i]).toFixed(4)])),
    candidates:[], best:null, applied:null, added_links:[], removed_links:[],
    links:links.map(l=>({source:l.source,target:l.target})), budget_remaining:budget });

  for (let b=0; b<budget; b++) {
    const adj = linksToAdj(allIds, links);
    const candidates = [];

    // inter-C ADD for each target
    for (let ti=0; ti<k; ti++) {
      const comm=tSets[ti];
      let minR=Infinity, np=null;
      for (const u of comm){ const d=adj[u].size; if(!d) continue; const r=[...adj[u]].filter(v=>!comm.has(v)).length/d; if(r<minR){minR=r;np=u;} }
      if (np===null) continue;
      const ext=allIds.filter(v=>!comm.has(v)&&!adj[np].has(v)&&v!==np);
      for (const nt of ext.slice(0,15)) {
        const d=adj[np].size;
        const inter=[...adj[np]].filter(v=>!comm.has(v)).length;
        const dSig = d>0 ? 0.5*(d-inter)/(d*(d+1)) : 0;
        const meanGain = dSig/k;
        const isInterTarget = tAll.has(nt)&&!comm.has(nt);
        const penalty = isInterTarget ? lambda/Math.max(1,k-1) : 0;
        const deltaP = meanGain-penalty;
        candidates.push({ type:'ADD', u:np, v:nt, ti, delta_phi:+deltaP.toFixed(6), mean_gain:+meanGain.toFixed(6), penalty:+penalty.toFixed(6), valid:true,
          reason:`inter-C ADD C${targets[ti].commId}: (${np}→${nt})${isInterTarget?' [PENALISED]':''}` });
      }
    }

    // intra-C DELETE for each target
    for (let ti=0; ti<k; ti++) {
      const comm=tSets[ti];
      const intra=links.filter(l=>comm.has(l.source)&&comm.has(l.target));
      for (const lk of intra) {
        if (isBridge(adj,comm,lk.source,lk.target)) {
          candidates.push({ type:'DEL', u:lk.source, v:lk.target, ti, delta_phi:0, mean_gain:0, penalty:0, valid:false,
            reason:`intra-C DEL C${targets[ti].commId}: (${lk.source}–${lk.target}) SKIP bridge` }); continue;
        }
        const tl=links.filter(l=>!((l.source===lk.source&&l.target===lk.target)||(l.source===lk.target&&l.target===lk.source)));
        const ta=linksToAdj(allIds,tl);
        const dSig=computeSafeness(ta,comm)-computeSafeness(adj,comm);
        const mg=dSig/k;
        candidates.push({ type:'DEL', u:lk.source, v:lk.target, ti, delta_phi:+mg.toFixed(6), mean_gain:+mg.toFixed(6), penalty:0, valid:true,
          reason:`intra-C DEL C${targets[ti].commId}: (${lk.source}–${lk.target}) ΔΦ=${mg.toFixed(4)}` });
      }
    }

    const valid=candidates.filter(c=>c.valid).sort((a,b)=>b.delta_phi-a.delta_phi);
    const best=valid[0]||null;
    const allSorted=[...valid,...candidates.filter(c=>!c.valid)];
    const curSigmas=Object.fromEntries(targets.map((t,i)=>[t.commId,+computeSafeness(adj,tSets[i]).toFixed(4)]));
    const curMean=+(Object.values(curSigmas).reduce((a,b)=>a+b,0)/k).toFixed(4);

    if (!best||best.delta_phi<=0) {
      steps.push({ step:b+1, type:'stop', description:`No improving operation at β=${b+1}`,
        sigma:curSigmas, mean_sigma:curMean,
        psi:Object.fromEntries(targets.map((t,i)=>[t.commId,+computePsi(adj,tSets[i]).toFixed(4)])),
        phi:Object.fromEntries(targets.map((t,i)=>[t.commId,+computePhi(adj,tSets[i]).toFixed(4)])),
        candidates:allSorted, best:null, applied:null, added_links:[], removed_links:[],
        links:links.map(l=>({source:l.source,target:l.target})), budget_remaining:budget-b }); break;
    }

    const addedL=[],removedL=[];
    if (best.type==='ADD'){links.push({source:best.u,target:best.v});addedL.push({source:best.u,target:best.v});}
    else{links=links.filter(l=>!((l.source===best.u&&l.target===best.v)||(l.source===best.v&&l.target===best.u)));removedL.push({source:best.u,target:best.v});}

    const newAdj=linksToAdj(allIds,links);
    const newSigmas=Object.fromEntries(targets.map((t,i)=>[t.commId,+computeSafeness(newAdj,tSets[i]).toFixed(4)]));
    const newMean=+(Object.values(newSigmas).reduce((a,b)=>a+b,0)/k).toFixed(4);

    steps.push({ step:b+1, type:best.type==='ADD'?'add':'delete',
      description:`β=${b+1}: ${best.type} (${best.u}↔${best.v}) for C${targets[best.ti]?.commId} ΔΦ=${best.delta_phi.toFixed(4)}${best.penalty>0?` [penalty −${best.penalty.toFixed(4)}]`:''}`,
      sigma:newSigmas, mean_sigma:newMean,
      psi:Object.fromEntries(targets.map((t,i)=>[t.commId,+computePsi(newAdj,tSets[i]).toFixed(4)])),
      phi:Object.fromEntries(targets.map((t,i)=>[t.commId,+computePhi(newAdj,tSets[i]).toFixed(4)])),
      candidates:allSorted, best,
      applied:{type:best.type,u:best.u,v:best.v,target_comm:targets[best.ti]?.commId,delta_phi:best.delta_phi,mean_gain:best.mean_gain,penalty:best.penalty},
      added_links:addedL, removed_links:removedL,
      links:links.map(l=>({source:l.source,target:l.target})), budget_remaining:budget-b-1 });
  }

  const finalAdj=linksToAdj(allIds,links);
  const finalSigmas=Object.fromEntries(targets.map((t,i)=>[t.commId,+computeSafeness(finalAdj,tSets[i]).toFixed(4)]));
  const finalDet=detectCommunities(nodes,links,detectionAlgo);
  const allMembers=targets.flatMap(t=>t.members);
  const hScores=Object.fromEntries(targets.map(t=>[t.commId,+computeHScore(finalDet.assignment,t.members).toFixed(4)]));
  const combinedH=+computeHScore(finalDet.assignment,allMembers).toFixed(4);

  return { algorithm:'MHs-Joint', target_communities:targets.map(t=>t.commId), budget, lambda, steps,
    summary:{ sigma_before:initSigmas, sigma_after:finalSigmas, mean_sigma_before:initMean,
      mean_sigma_after:+(Object.values(finalSigmas).reduce((a,b)=>a+b,0)/k).toFixed(4),
      h_scores:hScores, combined_h_score:combinedH,
      total_perturbations:steps.filter(s=>s.applied).length, final_links:links, final_communities:finalDet } };
}

module.exports = { runMHs };
