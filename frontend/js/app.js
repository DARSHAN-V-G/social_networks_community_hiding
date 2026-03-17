// app.js — main controller, wires everything together

const APP = {
  mode: 'single',
  graph: null,
  detection: null,
  targets: [],        // [{commId, members, color}]
  hidingResult: null,
  algo: 'louvain'
};

const TARGET_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];

// ── INIT ─────────────────────────────────────────────────────
async function init() {
  loadPreloadedList();
  bindEvents();
  setStep(1);
}

// ── PRELOADED DATASETS ───────────────────────────────────────
async function loadPreloadedList() {
  try {
    const { datasets } = await API.getDatasets();
    const list = document.getElementById('preloadedList');
    list.innerHTML = '';
    if (!datasets.length) {
      list.innerHTML = '<div style="color:var(--tx3);font-size:10px;font-family:var(--mono)">No datasets found in /datasets folder</div>';
      return;
    }
    datasets.forEach(ds => {
      const el = document.createElement('div');
      el.className = 'ds-item';
      el.dataset.name = ds.name;
      el.innerHTML = `
        <div>
          <div class="ds-item-name">${ds.name.replace(/\.[^.]+$/, '')}</div>
          <div class="ds-item-meta">${(ds.size / 1024).toFixed(1)} KB</div>
        </div>
        <span class="ds-ext">${ds.ext}</span>`;
      el.addEventListener('click', () => loadPreloaded(ds.name, el));
      list.appendChild(el);
    });
  } catch (e) {
    showToast('Cannot reach backend. Make sure the server is running on port 3001.', 'error');
  }
}

async function loadPreloaded(filename, el) {
  setLoading(true, `Loading ${filename}...`);
  try {
    const data = await API.loadPreloaded(filename);
    document.querySelectorAll('.ds-item').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    onGraphLoaded(data.graph);
    showToast(`Loaded: ${filename} (${data.graph.nodeCount} nodes, ${data.graph.edgeCount} edges)`, 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ── FILE UPLOAD ───────────────────────────────────────────────
function bindUpload() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragging');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
}

async function handleFile(file) {
  setLoading(true, `Uploading ${file.name}...`);
  try {
    const data = await API.uploadFile(file);
    document.querySelectorAll('.ds-item').forEach(x => x.classList.remove('active'));
    onGraphLoaded(data.graph);
    showToast(`Uploaded: ${file.name} (${data.graph.nodeCount} nodes, ${data.graph.edgeCount} edges)`, 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    setLoading(false);
  }
}

function onGraphLoaded(graph) {
  APP.graph = graph;
  APP.detection = null;
  APP.targets = [];
  APP.hidingResult = null;

  document.getElementById('btnDetect').disabled = false;
  document.getElementById('btnHide').disabled = true;

  updateStats(graph.nodeCount, graph.edgeCount, '—', '—');
  document.getElementById('commList').innerHTML = '<div style="color:var(--tx3);font-size:10px;font-family:var(--mono)">Detect communities first</div>';
  document.getElementById('selectionInfo').textContent = 'Detect communities first';

  // draw initial graph
  GRAPH.draw('svgBefore', graph.nodes, graph.links, buildFlatComm(graph.nodes), []);
  GRAPH.draw('svgAfter', graph.nodes, graph.links, buildFlatComm(graph.nodes), []);
  resetAfterPane();
  setStep(2);
}

// ── DETECTION ─────────────────────────────────────────────────
async function runDetection() {
  if (!APP.graph) return;
  setLoading(true, 'Running community detection...');
  try {
    const data = await API.detect(APP.algo);
    APP.detection = data;
    APP.targets = [];
    APP.hidingResult = null;

    document.getElementById('beforeAlgo').textContent = APP.algo === 'louvain' ? 'Louvain' : 'LPA';
    document.getElementById('afterAlgo').textContent = APP.algo === 'louvain' ? 'Louvain' : 'LPA';

    GRAPH.draw('svgBefore', APP.graph.nodes, APP.graph.links, data.nodeComm, []);
    GRAPH.buildLegend('legendBefore', 'legendBeforeItems', data.nodeComm, []);
    resetAfterPane();

    buildCommList(data.communities);
    updateStats(APP.graph.nodeCount, APP.graph.edgeCount, data.count, '0');
    document.getElementById('selectionInfo').textContent =
      APP.mode === 'multi' ? 'Select up to 5 communities' : 'Select 1 community to hide';
    setStep(3);
    showToast(`Found ${data.count} communities using ${APP.algo === 'louvain' ? 'Louvain' : 'Label Propagation'}`, 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ── COMMUNITY LIST ────────────────────────────────────────────
function buildCommList(communities) {
  const list = document.getElementById('commList');
  list.innerHTML = '';
  communities.forEach((c, idx) => {
    const col = GRAPH.PALETTE[c.id % GRAPH.PALETTE.length];
    const targetCol = TARGET_COLORS[idx % TARGET_COLORS.length];
    const el = document.createElement('div');
    el.className = 'comm-item';
    el.dataset.cid = c.id;
    el.dataset.idx = idx;
    el.style.setProperty('--item-col', targetCol);
    el.innerHTML = `
      <div class="comm-swatch" style="background:${col}"></div>
      <div class="comm-text">
        <div class="comm-label">Community ${c.id}</div>
        <div class="comm-meta">${c.size} nodes · σ=${c.safeness}</div>
      </div>
      <div class="comm-check">✓</div>`;
    el.addEventListener('click', () => toggleTarget(c, idx, targetCol, el));
    list.appendChild(el);
  });
}

function toggleTarget(comm, colorIdx, color, el) {
  const commId = comm.id;
  const existing = APP.targets.findIndex(t => t.commId === commId);

  if (existing >= 0) {
    APP.targets.splice(existing, 1);
    el.classList.remove('selected');
  } else {
    if (APP.mode === 'single') {
      APP.targets = [];
      document.querySelectorAll('.comm-item').forEach(x => x.classList.remove('selected'));
    }
    if (APP.mode === 'multi' && APP.targets.length >= 5) {
      showToast('Max 5 target communities in multi mode', 'error');
      return;
    }
    APP.targets.push({ commId, members: comm.members, color });
    el.classList.add('selected');
  }

  const tgtIds = APP.targets.map(t => t.commId);
  updateStats(APP.graph.nodeCount, APP.graph.edgeCount, APP.detection.count, APP.targets.length || '—');

  // redraw before graph with target highlights
  const tgtObjs = APP.targets.map((t, i) => ({ ...t, members: t.members }));
  GRAPH.draw('svgBefore', APP.graph.nodes, APP.graph.links, APP.detection.nodeComm, tgtObjs);
  GRAPH.buildLegend('legendBefore', 'legendBeforeItems', APP.detection.nodeComm, tgtIds);
  GRAPH.buildTargetChips('chipsB', APP.targets);

  document.getElementById('btnHide').disabled = APP.targets.length === 0;
  if (APP.targets.length > 0) setStep(4);
}

// ── HIDING ────────────────────────────────────────────────────
async function runHiding() {
  if (!APP.targets.length) return;
  setLoading(true, 'Running hiding algorithm...');

  const budget = parseInt(document.getElementById('budgetSlider').value);
  const lambda = parseFloat(document.getElementById('lambdaSlider').value);

  try {
    const payload = {
      mode: APP.mode,
      targetCommIds: APP.targets.map(t => t.commId),
      budget,
      lambda,
      algorithm: APP.algo
    };
    const data = await API.hide(payload);
    APP.hidingResult = data;

    // draw after graph
    const tgtObjs = APP.targets.map((t, i) => ({ ...t }));
    const addedEdgePairs = data.steps
      .filter(s => s.addedEdge)
      .map(s => [s.addedEdge.source, s.addedEdge.target]);

    GRAPH.draw('svgAfter', APP.graph.nodes, data.finalLinks, data.postHidingDetection.nodeComm, tgtObjs, addedEdgePairs);
    GRAPH.buildLegend('legendAfter', 'legendAfterItems', data.postHidingDetection.nodeComm, APP.targets.map(t => t.commId));
    GRAPH.buildTargetChips('chipsA', APP.targets);

    document.getElementById('emptyAfter').style.display = 'none';
    document.getElementById('legendAfter').style.display = 'block';

    // populate analysis tab
    populateAnalysis(data);

    // init step explorer
    STEPS.init(data.steps, APP.graph.nodes, APP.graph.links, APP.targets);
    document.getElementById('btnNextStep').disabled = false;
    document.getElementById('btnRunAll').disabled = false;

    showToast(`Hidden! H-score: ${data.summary.hScoreBefore} → ${data.summary.hScoreAfter} (+${data.summary.hScoreGain})`, 'success');

    // auto-switch to step explorer
    switchTab('steps');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ── ANALYSIS TAB ──────────────────────────────────────────────
function populateAnalysis(data) {
  const s = data.summary;
  document.getElementById('hBefore').textContent = s.hScoreBefore;
  document.getElementById('hAfter').textContent = s.hScoreAfter;
  document.getElementById('hGain').textContent = '+' + s.hScoreGain;
  document.getElementById('hPerts').textContent = s.totalPerturbations;

  // per-community cards
  const grid = document.getElementById('perCommScores');
  grid.innerHTML = '';
  s.perTargetScores.forEach((pc, i) => {
    const col = TARGET_COLORS[i % TARGET_COLORS.length];
    const gain = (pc.sigmaAfter - pc.sigmaBefore).toFixed(4);
    const el = document.createElement('div');
    el.className = 'pc-card';
    el.style.setProperty('--pc-col', col);
    el.innerHTML = `
      <div class="pc-name" style="color:${col}">Community ${pc.commId}</div>
      <div class="pc-row"><span class="pc-key">σ before</span><span class="pc-val">${pc.sigmaBefore}</span></div>
      <div class="pc-row"><span class="pc-key">σ after</span><span class="pc-val">${pc.sigmaAfter}</span></div>
      <div class="pc-row"><span class="pc-key">Δσ</span><span class="pc-gain">+${gain}</span></div>
      <div class="pc-row"><span class="pc-key">H before</span><span class="pc-val">${pc.hBefore}</span></div>
      <div class="pc-row"><span class="pc-key">H after</span><span class="pc-val">${pc.hAfter}</span></div>`;
    grid.appendChild(el);
  });

  // perturbation log
  const tbody = document.getElementById('pertLog');
  tbody.innerHTML = '';
  data.steps.filter(s => s.best).forEach((s, i) => {
    const b = s.best;
    const tr = document.createElement('tr');
    const commId = b.commId !== undefined ? b.commId : APP.targets[0]?.commId;
    const col = TARGET_COLORS[(APP.targets.findIndex(t => t.commId === commId)) % TARGET_COLORS.length] || '#888';
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="${b.type === 'ADD' ? 'td-add' : 'td-del'}">${b.type === 'ADD' ? '+ ADD' : '− DEL'}</td>
      <td style="font-family:var(--mono)">${b.u} ↔ ${b.v}</td>
      <td style="color:${col}">C${commId}</td>
      <td style="color:var(--tx3)">${b.type === 'ADD' ? 'inter-C link' : 'intra-C link'}</td>
      <td style="color:var(--ac3)">+${b.netGain}</td>`;
    tbody.appendChild(tr);
  });
  if (!data.steps.filter(s => s.best).length) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--tx3);padding:10px;font-family:var(--mono)">No perturbations applied</td></tr>';
  }
}

// ── HELPERS ───────────────────────────────────────────────────
function buildFlatComm(nodes) {
  const nc = {};
  nodes.forEach(n => nc[n.id] = 0);
  return nc;
}

function resetAfterPane() {
  document.getElementById('svgAfter').innerHTML = '';
  document.getElementById('emptyAfter').style.display = 'flex';
  document.getElementById('legendAfter').style.display = 'none';
  document.getElementById('chipsA').innerHTML = '';
}

function updateStats(n, e, c, t) {
  document.getElementById('stN').textContent = n;
  document.getElementById('stE').textContent = e;
  document.getElementById('stC').textContent = c;
  document.getElementById('stT').textContent = t;
}

function setStep(n) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('sn' + i);
    if (!el) continue;
    el.className = 'step-num' + (i < n ? ' done' : i === n ? ' active' : '');
    el.textContent = i < n ? '✓' : i;
  }
}

function setLoading(on, msg = '') {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  dot.className = 'status-dot' + (on ? ' loading' : ' ok');
  txt.textContent = on ? msg : (APP.graph ? `${APP.graph.nodeCount} nodes loaded` : 'No dataset loaded');
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
}

// ── EVENT BINDING ─────────────────────────────────────────────
function bindEvents() {
  bindUpload();

  document.getElementById('btnDetect').addEventListener('click', runDetection);
  document.getElementById('btnHide').addEventListener('click', runHiding);

  document.getElementById('btnReset').addEventListener('click', () => {
    GRAPH.stopAll();
    APP.graph = null; APP.detection = null; APP.targets = []; APP.hidingResult = null;
    ['svgBefore', 'svgAfter', 'svgStep'].forEach(id => document.getElementById(id).innerHTML = '');
    ['legendBefore', 'legendAfter'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById('emptyAfter').style.display = 'flex';
    document.getElementById('commList').innerHTML = '';
    document.getElementById('chipsB').innerHTML = '';
    document.getElementById('chipsA').innerHTML = '';
    document.getElementById('btnDetect').disabled = true;
    document.getElementById('btnHide').disabled = true;
    updateStats('—', '—', '—', '—');
    setStep(1);
    STEPS.init([], [], [], []);
    loadPreloadedList();
  });

  document.getElementById('budgetSlider').addEventListener('input', e => {
    document.getElementById('budgetVal').textContent = e.target.value;
  });
  document.getElementById('lambdaSlider').addEventListener('input', e => {
    document.getElementById('lambdaVal').textContent = parseFloat(e.target.value).toFixed(2);
  });

  // Mode toggle
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      APP.mode = b.dataset.mode;
      const isMulti = APP.mode === 'multi';
      document.getElementById('lambdaRow').style.display = isMulti ? 'block' : 'none';
      document.getElementById('selectionInfo').textContent = isMulti ? 'Select up to 5 communities' : 'Select 1 community to hide';
      // clear selections
      APP.targets = [];
      document.querySelectorAll('.comm-item').forEach(x => x.classList.remove('selected'));
      document.getElementById('btnHide').disabled = true;
      document.getElementById('chipsB').innerHTML = '';
      if (APP.detection) {
        GRAPH.draw('svgBefore', APP.graph.nodes, APP.graph.links, APP.detection.nodeComm, []);
      }
    });
  });

  // Algorithm radio
  document.querySelectorAll('.algo-opt').forEach(opt => {
    opt.querySelector('input').addEventListener('change', () => {
      document.querySelectorAll('.algo-opt').forEach(x => x.classList.remove('active'));
      opt.classList.add('active');
      APP.algo = opt.dataset.algo;
    });
    opt.addEventListener('click', () => {
      document.querySelectorAll('.algo-opt').forEach(x => x.classList.remove('active'));
      opt.classList.add('active');
      APP.algo = opt.dataset.algo;
      opt.querySelector('input').checked = true;
    });
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });

  // Step explorer buttons
  document.getElementById('btnNextStep').addEventListener('click', () => STEPS.next());
  document.getElementById('btnPrevStep').addEventListener('click', () => STEPS.prev());
  document.getElementById('btnRunAll').addEventListener('click', () => {
    document.getElementById('btnNextStep').disabled = true;
    document.getElementById('btnPrevStep').disabled = true;
    STEPS.runAll(() => {
      document.getElementById('btnNextStep').disabled = false;
      document.getElementById('btnPrevStep').disabled = false;
    });
  });
}

// ── START ─────────────────────────────────────────────────────
init();
