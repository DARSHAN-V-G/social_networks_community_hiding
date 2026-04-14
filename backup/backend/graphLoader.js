// graphLoader.js — parse .txt, .csv, .json into standard { nodes, links }
const path = require('path');

function buildGraph(edgeList) {
  const nodeSet = new Set();
  const seen = new Set();
  const links = [];
  for (const [s, t] of edgeList) {
    const si = parseInt(s), ti = parseInt(t);
    if (isNaN(si) || isNaN(ti) || si === ti) continue;
    const key = `${Math.min(si,ti)}-${Math.max(si,ti)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nodeSet.add(si); nodeSet.add(ti);
    links.push({ source: si, target: ti });
  }
  const nodes = [...nodeSet].sort((a,b)=>a-b).map(id=>({id}));
  return { nodes, links };
}

function loadTXT(content) {
  const edges = [];
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('%')) continue;
    const p = t.split(/[\s,\t]+/);
    if (p.length >= 2) edges.push([p[0], p[1]]);
  }
  return buildGraph(edges);
}

function loadCSV(content) {
  const lines = content.split('\n').map(l=>l.trim()).filter(l=>l);
  if (!lines.length) throw new Error('Empty CSV');
  const first = lines[0].split(',');
  const isMatrix = first.length > 2 && lines.length >= first.length - 1;
  const edges = [];
  if (isMatrix) {
    const start = isNaN(parseInt(first[0])) ? 1 : 0;
    for (let i = start; i < lines.length; i++) {
      const row = lines[i].split(',');
      const ni = i - start;
      for (let j = 0; j < row.length; j++) {
        if (parseFloat(row[j]) > 0 && j !== ni) edges.push([ni, j]);
      }
    }
  } else {
    const start = isNaN(parseInt(first[0])) ? 1 : 0;
    for (let i = start; i < lines.length; i++) {
      const p = lines[i].split(',');
      if (p.length >= 2) edges.push([p[0].trim(), p[1].trim()]);
    }
  }
  return buildGraph(edges);
}

function loadJSON(content) {
  const data = JSON.parse(content);
  if (data.nodes && (data.links || data.edges)) {
    const ll = data.links || data.edges;
    return buildGraph(ll.map(l => Array.isArray(l) ? l : [l.source??l.from, l.target??l.to]));
  }
  if (Array.isArray(data)) return buildGraph(data);
  if (typeof data === 'object') {
    const edges = [];
    for (const [n, nbs] of Object.entries(data)) for (const nb of nbs) edges.push([n, nb]);
    return buildGraph(edges);
  }
  throw new Error('Unrecognized JSON format');
}

function loadGraphFromContent(filename, content) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.txt') return loadTXT(content);
  if (ext === '.csv') return loadCSV(content);
  if (ext === '.json') return loadJSON(content);
  throw new Error(`Unsupported format: ${ext}`);
}

module.exports = { loadGraphFromContent };
