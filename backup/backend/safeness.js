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
  // rho(C) = sum of shortest path lengths between every pair of nodes in C
  // Paper Definition 3: ρ(C̃) = Σ_u Σ_v sp(u,v) for u,v ∈ C̃, u ≠ v

  const cn = [...commSet];  // convert the community Set to an array so we can index it
  let total = 0;            // accumulator for sum of all pairwise shortest paths

  for (let i = 0; i < cn.length; i++) {
    // --- BFS from community node cn[i] to find shortest path to every other node ---

    const dist = { [cn[i]]: 0 };  // distance map: start node has distance 0 from itself
    const q = [cn[i]];            // BFS queue: begin with the start node

    while (q.length) {
      const c = q.shift();          // dequeue the front node

      for (const nb of adj[c]) {    // look at every neighbour of c (across full graph)
        if (!(nb in dist)) {        // if this neighbour hasn't been visited yet
          dist[nb] = dist[c] + 1;   // its distance = parent distance + 1 hop
          q.push(nb);               // enqueue it for further exploration
        }
      }
    }

    // --- After BFS: add distances from cn[i] to every OTHER community node ---
    for (let j = 0; j < cn.length; j++) {
      if (i !== j) {                         // skip self (distance to itself = 0, doesn't matter)
        total += dist[cn[j]] || 0;           // add shortest path length; fallback 0 if unreachable
      }
    }
  }

  return total;  // rho(C): total sum of all pairwise shortest paths inside community
}

//intra community safeness
function computePsi(adj, commSet) {
  const n = commSet.size;
  if (n <= 1) return 0;
  const rho = computeRho(adj, commSet);
  const rMin = 2*(n-1)*(n-1);  // paper Eq.2: ρ_min = 2(n−1)²
  let rMax = 0;
  // Compute ρ_max: maximum dispersion for n nodes in a line topology (paper Eq.2)
  // Σ_{k=1}^{n} ( Σ_{i=1}^{n-k} i  +  Σ_{j=0}^{k-1} j )
  for (let k = 1; k <= n; k++) {
    for (let i = 1; i <= n - k; i++) {
      rMax += i;   // distances from node k to all nodes to its RIGHT
    }
    for (let j = 0; j < k; j++) {
      rMax += j;   // distances from node k to all nodes to its LEFT (j=0 adds 0, safe)
    }
  }

  if (rMax===rMin) return 0;
  return Math.max(0, Math.min(1, (rho-rMin)/(rMax-rMin)));
}

//intra community safeness
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
