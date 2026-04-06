// api.js — API client for backend communication

const API = {
  BASE_URL: 'http://localhost:3001',

  async getDatasets() {
    const res = await fetch(`${this.BASE_URL}/api/datasets`);
    if (!res.ok) throw new Error('Failed to load datasets');
    const data = await res.json();
    return {
      datasets: data.datasets.map(ds => ({
        ...ds,
        ext: ds.format,
        name: ds.filename
      }))
    };
  },

  async loadPreloaded(filename) {
    const res = await fetch(`${this.BASE_URL}/api/load/preloaded`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to load dataset');
    }
    const data = await res.json();
    return this._formatGraphResponse(data);
  },

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${this.BASE_URL}/api/load/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to upload file');
    }
    const data = await res.json();
    return this._formatGraphResponse(data);
  },

  async detect(algorithm) {
    return this.detectOnGraph(APP.graph.nodes, APP.graph.links, algorithm);
  },

  async detectOnGraph(nodes, links, algorithm) {
    const res = await fetch(`${this.BASE_URL}/api/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodes,
        links,
        algorithm: algorithm || 'louvain'
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Detection failed');
    }
    const data = await res.json();
    return this._formatDetectionResponse(data);
  },

  async hide(payload) {
    const { mode, targetCommIds, budget, lambda, algorithm } = payload;
    
    if (mode === 'single') {
      const target = APP.targets[0];
      const res = await fetch(`${this.BASE_URL}/api/hide/hs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: APP.graph.nodes,
          links: APP.graph.links,
          targetCommId: target.commId,
          targetMembers: target.members,
          budget,
          algorithm
        })
      });
      if (!res.ok) throw new Error('Hiding failed (HS)');
      const data = await res.json();
      return this._formatHidingResponse(data);
    } else {
      const targets = APP.targets.map(t => ({ commId: t.commId, members: t.members }));
      const res = await fetch(`${this.BASE_URL}/api/hide/mhs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: APP.graph.nodes,
          links: APP.graph.links,
          targets,
          budget,
          lambda,
          algorithm
        })
      });
      if (!res.ok) throw new Error('Hiding failed (MHS)');
      const data = await res.json();
      return this._formatHidingResponse(data, mode);
    }
  },

  _formatHidingResponse(data, mode = 'single') {
    const summary = data.summary || {};
    const finalDet = summary.final_communities || summary.final_detection || {};
    
    // Ensure we have valid community assignments
    let nodeComm = finalDet.assignment || finalDet.nodeComm || {};
    if (typeof nodeComm !== 'object' || nodeComm === null) {
      nodeComm = {};
    }
    
    // Transform steps to frontend format
    const steps = (data.steps || []).map((step) => {
      // Handle both single and multi target sigma format
      let sigmas = {};
      if (step.sigma && typeof step.sigma === 'object') {
        sigmas = step.sigma;
      } else if (step.mean_sigma !== undefined) {
        // For single target, store under the target community ID
        const targetId = APP.targets[0]?.commId;
        if (targetId !== undefined) {
          sigmas[targetId] = step.mean_sigma;
        }
      }
      
      const best = step.best || null;
      const applied = step.applied || null;
      const netGain = best ? (best.netGain ?? best.delta_phi ?? best.delta ?? best.mean_gain ?? 0) : 0;
      const commId = best ? (best.target_comm ?? best.commId ?? applied?.target_comm ?? APP.targets[0]?.commId) : undefined;

      return {
        ...step,
        sigmas: sigmas,
        best: best ? { ...best, netGain, commId } : null,
        addedEdge: applied && applied.type === 'ADD'
          ? { source: applied.u, target: applied.v }
          : null,
        candidates: (step.candidates || []).slice(0, 10).map(c => ({
          type: c.type,
          u: c.u,
          v: c.v,
          gain: c.delta_phi !== undefined ? c.delta_phi : (c.delta ?? c.mean_gain ?? 0)
        }))
      };
    });

    // Extract H-scores from summary
    const hScoreCommunities = summary.h_scores || {};
    const hScoreCommunitiesBefore = summary.h_scores_before || {};
    // hScoreBefore = mean of per-community before scores
    const hBeforeVals = Object.values(hScoreCommunitiesBefore);
    let hScoreBefore = hBeforeVals.length ? +(hBeforeVals.reduce((a,b)=>a+b,0)/hBeforeVals.length).toFixed(4) : 0;
    let hScoreAfter = typeof summary.combined_h_score === 'number' ? summary.combined_h_score : (Object.values(hScoreCommunities)[0] || 0);

    // Handle case where h_scores might be single value
    if (typeof hScoreBefore !== 'number') hScoreBefore = 0;
    if (typeof hScoreAfter !== 'number') hScoreAfter = 0;

    // Build per-target scores
    const perTargetScores = APP.targets.map((target, idx) => ({
      commId: target.commId,
      sigmaBefore: (summary.sigma_before && summary.sigma_before[target.commId]) || 0,
      sigmaAfter: (summary.sigma_after && summary.sigma_after[target.commId]) || 0,
      hBefore: (summary.h_scores_before && summary.h_scores_before[target.commId]) || 0,
      hAfter: (summary.h_scores && summary.h_scores[target.commId]) || 0
    }));

    return {
      algorithm: data.algorithm || 'Hs',
      steps: steps,
      finalLinks: summary.final_links || APP.graph.links || [],
      postHidingDetection: {
        nodeComm: nodeComm
      },
      summary: {
        hScoreBefore: hScoreBefore,
        hScoreAfter: hScoreAfter,
        hScoreGain: +((hScoreAfter - hScoreBefore).toFixed(4)),
        totalPerturbations: summary.total_perturbations || steps.filter(s => s.applied).length,
        perTargetScores: perTargetScores
      }
    };
  },

  _formatGraphResponse(data) {
    const rawNodes = data.graph.nodes || [];
    const rawLinks = data.graph.links || [];

    const originalNodeMap = new Map(rawNodes.map(n => [Number(n.id), n]));
    const idSet = new Set(rawNodes.map(n => Number(n.id)));

    rawLinks.forEach(l => {
      const s = Number(typeof l.source === 'object' ? l.source.id : l.source);
      const t = Number(typeof l.target === 'object' ? l.target.id : l.target);
      if (Number.isFinite(s)) idSet.add(s);
      if (Number.isFinite(t)) idSet.add(t);
    });

    const sortedIds = Array.from(idSet).sort((a, b) => a - b);
    const remap = new Map(sortedIds.map((id, idx) => [id, idx + 1]));

    const nodes = sortedIds.map(oldId => {
      const oldNode = originalNodeMap.get(oldId) || {};
      return {
        id: remap.get(oldId),
        x: oldNode.x,
        y: oldNode.y
      };
    });

    const seenEdges = new Set();
    const links = [];
    rawLinks.forEach(l => {
      const sOld = Number(typeof l.source === 'object' ? l.source.id : l.source);
      const tOld = Number(typeof l.target === 'object' ? l.target.id : l.target);
      const s = remap.get(sOld);
      const t = remap.get(tOld);
      if (!s || !t || s === t) return;

      const k1 = Math.min(s, t);
      const k2 = Math.max(s, t);
      const key = `${k1}-${k2}`;
      if (seenEdges.has(key)) return;
      seenEdges.add(key);
      links.push({ source: s, target: t });
    });

    // Ensure all nodes have positions for visualization
    nodes.forEach(n => {
      if (!n.x) n.x = Math.random() * 500;
      if (!n.y) n.y = Math.random() * 500;
    });

    return {
      filename: data.filename,
      graph: {
        nodes,
        links,
        nodeCount: nodes.length,
        edgeCount: links.length
      }
    };
  },

  _formatDetectionResponse(data) {
    const communities = data.community_sizes || [];
    const nodeComm = data.assignment || {};
    
    return {
      algorithm: data.algorithm,
      count: communities.length,
      modularity: data.modularity,
      nodeComm,
      communities: communities.map(c => ({
        id: c.id,
        size: c.size,
        members: c.members || [],
        safeness: 0.5 // Placeholder, compute from algorithm if available
      })),
      assignment: nodeComm
    };
  }
};
