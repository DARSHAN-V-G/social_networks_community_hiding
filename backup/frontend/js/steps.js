// steps.js — Step-by-step algorithm explorer

const STEPS = {
  steps: [],
  currentStep: 0,
  nodes: [],
  links: [],
  targets: [],
  isPlaying: false,

  init(steps, nodes, links, targets) {
    this.steps = steps || [];
    this.nodes = nodes || [];
    this.links = links || [];
    this.targets = targets || [];
    this.currentStep = 0;
    this.isPlaying = false;

    const counter = document.getElementById('stepCounter');
    const summary = document.getElementById('stepSummary');
    
    if (!this.steps.length) {
      counter.textContent = 'Step 0 / 0';
      summary.innerHTML = '<div class="step-empty">Run the hiding algorithm first, then step through each iteration here.</div>';
      return;
    }

    counter.textContent = `Step 0 / ${this.steps.length}`;
    this.renderStep(0);
  },

  next() {
    if (this.currentStep < this.steps.length) {
      this.currentStep++;
      this.renderStep(this.currentStep);
    }
  },

  prev() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.renderStep(this.currentStep);
    }
  },

  renderStep(stepNum) {
    document.getElementById('stepCounter').textContent = `Step ${stepNum} / ${this.steps.length}`;
    
    document.getElementById('btnPrevStep').disabled = stepNum === 0;
    document.getElementById('btnNextStep').disabled = stepNum >= this.steps.length;

    if (stepNum === 0) {
      document.getElementById('stepSummary').innerHTML = '<div class="step-summary-content"><strong>Initial State</strong><p>Graph before any perturbations.</p></div>';
      document.getElementById('stepSigmas').innerHTML = '';
      document.getElementById('candidateList').innerHTML = '';
      GRAPH.draw('svgStep', this.nodes, this.links, buildFlatComm(this.nodes), this.targets);
      return;
    }

    const step = this.steps[stepNum - 1];
    const prevStep = stepNum > 1 ? this.steps[stepNum - 2] : null;

    // Build summary
    const summary = document.getElementById('stepSummary');
    const bestOp = step.best;
    if (bestOp) {
      summary.innerHTML = `
        <div class="step-summary-content">
          <strong>Step ${stepNum}: Applied Operation</strong>
          <p style="margin-top:8px"><strong>${bestOp.type === 'ADD' ? 'ADD' : 'REMOVE'}</strong> edge (${bestOp.u} ↔ ${bestOp.v})</p>
          <p style="font-size:12px;color:var(--tx3);margin-top:6px">Net gain: <strong>${bestOp.netGain}</strong></p>
        </div>`;
    } else {
      summary.innerHTML = '<div class="step-summary-content"><p>No operation applied at this step.</p></div>';
    }

    // Build sigma boxes
    const sigmaContainer = document.getElementById('stepSigmas');
    sigmaContainer.innerHTML = '';
    if (step.sigmas) {
      Object.entries(step.sigmas).forEach(([commId, sigma]) => {
        const box = document.createElement('div');
        box.className = 'sigma-box';
        box.innerHTML = `<div class="sigma-label">C${commId}</div><div class="sigma-val">${(+sigma).toFixed(4)}</div>`;
        sigmaContainer.appendChild(box);
      });
    }

    // Build candidate list
    const candList = document.getElementById('candidateList');
    candList.innerHTML = '';
    if (step.candidates && step.candidates.length) {
      step.candidates.slice(0, 5).forEach((cand, idx) => {
        const item = document.createElement('div');
        item.className = 'cand-item' + (bestOp && cand.u === bestOp.u && cand.v === bestOp.v ? ' selected' : '');
        item.innerHTML = `
          <div class="cand-op">${cand.type === 'ADD' ? '+' : '−'}</div>
          <div class="cand-info">
            <div class="cand-edge">${cand.u} ↔ ${cand.v}</div>
            <div class="cand-gain">+${cand.gain}</div>
          </div>`;
        candList.appendChild(item);
      });
      if (step.candidates.length > 5) {
        const more = document.createElement('div');
        more.className = 'cand-more';
        more.textContent = `+${step.candidates.length - 5} more candidates`;
        candList.appendChild(more);
      }
    } else {
      candList.innerHTML = '<div class="cand-empty">No candidates</div>';
    }

    // Draw graph with cumulative changes
    const finalLinks = this.buildLinksUpToStep(stepNum);
    GRAPH.draw('svgStep', this.nodes, finalLinks, buildFlatComm(this.nodes), this.targets);
  },

  buildLinksUpToStep(stepNum) {
    let links = [...this.links];
    
    for (let i = 0; i < Math.min(stepNum, this.steps.length); i++) {
      const step = this.steps[i];
      if (!step.best) continue;

      const op = step.best;
      const linkIndex = links.findIndex(l => 
        (l.source === op.u && l.target === op.v) || 
        (l.source === op.v && l.target === op.u)
      );

      if (op.type === 'ADD') {
        if (linkIndex === -1) {
          links.push({ source: op.u, target: op.v });
        }
      } else if (op.type === 'DEL' || op.type === 'REMOVE') {
        if (linkIndex >= 0) {
          links.splice(linkIndex, 1);
        }
      }
    }

    return links;
  },

  runAll(callback) {
    this.isPlaying = true;
    const playStep = () => {
      if (this.currentStep < this.steps.length) {
        this.currentStep++;
        this.renderStep(this.currentStep);
        setTimeout(playStep, 500);
      } else {
        this.isPlaying = false;
        if (callback) callback();
      }
    };
    playStep();
  }
};
