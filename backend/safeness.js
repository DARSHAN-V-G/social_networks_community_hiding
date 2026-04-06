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
  const rMin = 2*(n-1)*(n-1);  // paper Eq.2: ρ_min = 2(n−1)²
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

function computeHScore(assignment, targetMembers, adj) {
  const target = new Set(targetMembers);
  const n = target.size;

  // Reachability factor: |S(C)| = number of connected components among target nodes
  // Paper Eq.15: multiply by (1 - |S(C)|−1 / |C|−1)
  let reachFactor = 1;
  if (adj && n > 1) {
    // BFS within target nodes only to count connected components
    const visited = new Set();
    let components = 0;
    for (const start of target) {
      if (visited.has(start)) continue;
      components++;
      const q = [start];
      visited.add(start);
      while (q.length) {
        const cur = q.shift();
        if (adj[cur]) {
          for (const nb of adj[cur]) {
            if (target.has(nb) && !visited.has(nb)) { visited.add(nb); q.push(nb); }
          }
        }
      }
    }
    reachFactor = 1 - (components - 1) / (n - 1);  // paper Eq.15
  }

  const cm = {};
  for (const [nd,c] of Object.entries(assignment)){if(!cm[c])cm[c]=[];cm[c].push(+nd);}
  const comms = Object.values(cm);
  let maxR = 0;
  for (const c of comms){ const r=c.filter(nd=>target.has(nd)).length/target.size; if(r>maxR)maxR=r; }
  const rel = comms.filter(c=>c.some(nd=>target.has(nd)));
  let meanP = 0;
  if (rel.length){ for(const c of rel) meanP+=c.filter(nd=>target.has(nd)).length/c.length; meanP/=rel.length; }
  return Math.max(0, Math.min(1, reachFactor * (0.5*(1-maxR)+0.5*(1-meanP))));
}

module.exports = { linksToAdj, computeRho, computePsi, computePhi, computeSafeness, isBridge, computeHScore };
