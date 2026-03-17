// safeness.js — ψ, φ, σ, H-score, bridge detection

function linksToAdj(nodeIds, links) {
  const adj = {};
  nodeIds.forEach(id => adj[id] = new Set());
  links.forEach(l => {
    const s = typeof l.source==='object' ? l.source.id : l.source;
    const t = typeof l.target==='object' ? l.target.id : l.target;
    if (adj[s]!==undefined) adj[s].add(t);
    if (adj[t]!==undefined) adj[t].add(s);
  });
  return adj;
}

function computeRho(adj, commSet) {
  const cn = [...commSet];
  let total = 0;
  for (let i = 0; i < cn.length; i++) {
    const dist = {[cn[i]]:0}; const q = [cn[i]];
    while (q.length) { const c = q.shift(); for (const nb of adj[c]) if (!(nb in dist)){dist[nb]=dist[c]+1;q.push(nb);} }
    for (let j = 0; j < cn.length; j++) if (i!==j) total += dist[cn[j]]||0;
  }
  return total;
}

function computePsi(adj, commSet) {
  const n = commSet.size;
  if (n <= 1) return 0;
  const rho = computeRho(adj, commSet);
  const rMin = 2*(n-1)*(n-1);
  let rMax = 0;
  for (let k=1;k<=n;k++){for(let i=1;i<=n-k;i++)rMax+=i;for(let j=0;j<k-1;j++)rMax+=j;}
  if (rMax===rMin) return 0;
  return Math.max(0, Math.min(1, (rho-rMin)/(rMax-rMin)));
}

function computePhi(adj, commSet) {
  let total = 0;
  for (const u of commSet) {
    const deg = adj[u].size;
    if (!deg) continue;
    total += [...adj[u]].filter(v=>!commSet.has(v)).length / deg;
  }
  return total;
}

function computeSafeness(adj, commSet) {
  return 0.5*computePsi(adj,commSet) + 0.5*computePhi(adj,commSet);
}

function isBridge(adj, commSet, u, v) {
  const ta = {};
  for (const n of commSet) ta[n] = new Set([...adj[n]].filter(x=>commSet.has(x)));
  ta[u].delete(v); ta[v].delete(u);
  const start = [...commSet][0];
  const vis = new Set([start]); const q = [start];
  while (q.length){const c=q.shift();for(const nb of ta[c])if(!vis.has(nb)){vis.add(nb);q.push(nb);}}
  return vis.size !== commSet.size;
}

function computeHScore(assignment, targetMembers) {
  const target = new Set(targetMembers);
  const cm = {};
  for (const [n,c] of Object.entries(assignment)){if(!cm[c])cm[c]=[];cm[c].push(+n);}
  const comms = Object.values(cm);
  let maxR = 0;
  for (const c of comms){ const r=c.filter(n=>target.has(n)).length/target.size; if(r>maxR)maxR=r; }
  const rel = comms.filter(c=>c.some(n=>target.has(n)));
  let meanP = 0;
  if (rel.length){ for(const c of rel) meanP+=c.filter(n=>target.has(n)).length/c.length; meanP/=rel.length; }
  return Math.max(0, Math.min(1, 0.5*(1-maxR)+0.5*(1-meanP)));
}

module.exports = { linksToAdj, computePsi, computePhi, computeSafeness, isBridge, computeHScore };
