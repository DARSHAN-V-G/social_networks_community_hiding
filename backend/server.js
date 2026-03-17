// server.js — Express API
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { loadGraphFromContent } = require('./graphLoader');
const { detectCommunities, computeModularity } = require('./communityDetection');
const { runHs } = require('./hsAlgorithm');
const { runMHs } = require('./mhsAlgorithm');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.txt','.csv','.json'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Use .txt, .csv, or .json'), ok);
  }
});

app.get('/api/health', (_, res) => res.json({ status:'ok', version:'2.0.0' }));

app.get('/api/datasets', (_, res) => {
  const dir = path.join(__dirname, 'datasets');
  try {
    const files = fs.readdirSync(dir).filter(f=>['.txt','.csv','.json'].includes(path.extname(f).toLowerCase()));
    res.json({ datasets: files.map(f=>({
      id:f, filename:f,
      name: path.basename(f, path.extname(f)).replace(/[-_]/g,' '),
      format: path.extname(f).replace('.','').toUpperCase(),
      size: fs.statSync(path.join(dir,f)).size
    })) });
  } catch { res.json({ datasets:[] }); }
});

app.post('/api/load/preloaded', (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error:'filename required' });
  const fp = path.join(__dirname, 'datasets', filename);
  if (!fs.existsSync(fp)) return res.status(404).json({ error:'File not found' });
  try {
    const graph = loadGraphFromContent(filename, fs.readFileSync(fp,'utf8'));
    res.json({ success:true, filename, graph, stats:{ nodes:graph.nodes.length, edges:graph.links.length } });
  } catch(e) { res.status(400).json({ error:e.message }); }
});

app.post('/api/load/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error:'No file' });
  try {
    const graph = loadGraphFromContent(req.file.originalname, req.file.buffer.toString('utf8'));
    res.json({ success:true, filename:req.file.originalname, graph, stats:{ nodes:graph.nodes.length, edges:graph.links.length } });
  } catch(e) { res.status(400).json({ error:e.message }); }
});

app.post('/api/detect', (req, res) => {
  const { nodes, links, algorithm='louvain' } = req.body;
  if (!nodes||!links) return res.status(400).json({ error:'nodes and links required' });
  try {
    const result = detectCommunities(nodes, links, algorithm);
    const modularity = computeModularity(nodes, links, result.assignment);
    res.json({ success:true, algorithm, ...result, modularity:+modularity.toFixed(4),
      community_sizes: Object.entries(result.communities).map(([id,members])=>({id:+id,size:members.length,members})).sort((a,b)=>b.size-a.size) });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/hide/hs', (req, res) => {
  const { nodes, links, targetCommId, targetMembers, budget=10, algorithm='louvain' } = req.body;
  if (!nodes||!links||!targetMembers) return res.status(400).json({ error:'nodes, links, targetMembers required' });
  try {
    res.json({ success:true, ...runHs(nodes, links, targetCommId, targetMembers, Math.min(+budget,30), algorithm) });
  } catch(e) { console.error(e); res.status(500).json({ error:e.message }); }
});

app.post('/api/hide/mhs', (req, res) => {
  const { nodes, links, targets, budget=10, lambda=0.5, algorithm='louvain' } = req.body;
  if (!nodes||!links||!targets) return res.status(400).json({ error:'nodes, links, targets required' });
  try {
    res.json({ success:true, ...runMHs(nodes, links, targets, Math.min(+budget,30), +lambda, algorithm) });
  } catch(e) { console.error(e); res.status(500).json({ error:e.message }); }
});

app.get('*', (_, res) => res.sendFile(path.join(__dirname,'../frontend/index.html')));

app.listen(PORT, () => console.log(`\n  Community Privacy Lab  →  http://localhost:${PORT}\n`));
