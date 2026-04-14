// communityDetection.js — Louvain + LPA
const { linksToAdj } = require('./safeness');

function detectLouvain(nodes, links) {
  const adj = linksToAdj(nodes.map(n=>n.id), links);
  const m = links.length; if (!m) { const r={}; nodes.forEach((n,i)=>r[n.id]=i); return r; }
  const deg = {}; nodes.forEach(n=>deg[n.id]=adj[n.id].size);
  const comm = {}; nodes.forEach(n=>comm[n.id]=n.id);
  let improved=true, passes=0;
  while (improved && passes<100) {
    improved=false; passes++;
    const order = nodes.map(n=>n.id).sort(()=>Math.random()-.5);
    for (const id of order) {
      const cur = comm[id];
      const nbC = {};
      for (const nb of adj[id]) nbC[comm[nb]] = (nbC[comm[nb]]||0)+1;
      let best=cur, bestG=0;
      for (const [c,kIn] of Object.entries(nbC)) {
        if (+c===cur) continue;
        const cd = nodes.filter(n=>comm[n.id]===+c).reduce((s,n)=>s+deg[n.id],0);
        const g = kIn/m - (deg[id]*cd)/(2*m*m);
        if (g>bestG){bestG=g;best=+c;}
      }
      if (best!==cur){comm[id]=best;improved=true;}
    }
  }
  const uniq=[...new Set(Object.values(comm))].sort((a,b)=>a-b);
  const map={}; uniq.forEach((c,i)=>map[c]=i);
  const res={}; nodes.forEach(n=>res[n.id]=map[comm[n.id]]);
  return res;
}

function detectLPA(nodes, links) {
  const adj = linksToAdj(nodes.map(n=>n.id), links);
  const labels={}; nodes.forEach(n=>labels[n.id]=n.id);
  for (let it=0;it<50;it++){
    const order=nodes.map(n=>n.id).sort(()=>Math.random()-.5);
    let changed=false;
    for (const id of order){
      const nb={};
      for (const n of adj[id]) nb[labels[n]]=(nb[labels[n]]||0)+1;
      if (!Object.keys(nb).length) continue;
      const mx=Math.max(...Object.values(nb));
      const best=+[...Object.keys(nb).filter(k=>nb[k]===mx)].sort(()=>Math.random()-.5)[0];
      if (best!==labels[id]){labels[id]=best;changed=true;}
    }
    if(!changed) break;
  }
  const uniq=[...new Set(Object.values(labels))].sort((a,b)=>a-b);
  const map={}; uniq.forEach((l,i)=>map[l]=i);
  const res={}; nodes.forEach(n=>res[n.id]=map[labels[n.id]]);
  return res;
}

function detectCommunities(nodes, links, algorithm='louvain', runs=8) {
  const detect = algorithm==='louvain' ? detectLouvain : detectLPA;
  let best=null, bestK=0;
  for (let i=0;i<runs;i++){
    const r=detect(nodes,links); const k=new Set(Object.values(r)).size;
    if(k>bestK){bestK=k;best=r;}
  }
  const cm={};
  for(const[n,c]of Object.entries(best)){if(!cm[c])cm[c]=[];cm[c].push(+n);}
  return { assignment:best, communities:cm, count:Object.keys(cm).length };
}

function computeModularity(nodes, links, assignment) {
  const m=links.length; if(!m) return 0;
  const adj=linksToAdj(nodes.map(n=>n.id),links);
  const deg={}; nodes.forEach(n=>deg[n.id]=adj[n.id].size);
  let Q=0;
  for(const l of links){
    const s=typeof l.source==='object'?l.source.id:l.source;
    const t=typeof l.target==='object'?l.target.id:l.target;
    if(assignment[s]===assignment[t]) Q+=1-(deg[s]*deg[t])/(2*m);
  }
  return Q/m;
}

module.exports = { detectCommunities, computeModularity };
