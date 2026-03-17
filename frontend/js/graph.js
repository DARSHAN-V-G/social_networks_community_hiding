// graph.js — D3.js graph visualization

const GRAPH = {
  PALETTE: [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
    '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#6b7280'
  ],

  sims: {}, // simulation references keyed by svg id

  draw(svgId, nodes, links, nodeComm, targets = [], highlightedEdges = []) {
    const svg = document.getElementById(svgId);
    svg.innerHTML = '';

    if (!nodes || nodes.length === 0) {
      svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#999">No data</text>';
      return;
    }

    const width = svg.parentElement.offsetWidth || 600;
    const height = svg.parentElement.offsetHeight || 600;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Create a copy of nodes with positions
    const nodesCopy = nodes.map(n => ({
      ...n,
      x: n.x || Math.random() * width,
      y: n.y || Math.random() * height
    }));

    // Create a copy of links
    const linksCopy = links.map(l => ({
      source: typeof l.source === 'object' ? l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.id : l.target,
      ...l
    }));

    // Stop any existing simulation
    if (this.sims[svgId]) this.sims[svgId].stop();

    // Create simulation
    const sim = d3.forceSimulation(nodesCopy)
      .force('link', d3.forceLink()
        .id(d => d.id)
        .distance(30)
        .links(linksCopy))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(15));

    this.sims[svgId] = sim;

    const g = d3.select(`#${svgId}`);

    // Draw links
    const link = g.selectAll('line')
      .data(linksCopy, (d, i) => i)
      .join('line')
      .attr('stroke', d => {
        const isHighlighted = highlightedEdges.some(he => 
          (he[0] === d.source.id && he[1] === d.target.id) ||
          (he[1] === d.source.id && he[0] === d.target.id)
        );
        return isHighlighted ? '#22c55e' : '#d1d5db';
      })
      .attr('stroke-width', d => {
        const isHighlighted = highlightedEdges.some(he => 
          (he[0] === d.source.id && he[1] === d.target.id) ||
          (he[1] === d.source.id && he[0] === d.target.id)
        );
        return isHighlighted ? 2.5 : 1;
      })
      .attr('opacity', 0.6);

    // Draw nodes
    const node = g.selectAll('circle')
      .data(nodesCopy, d => d.id)
      .join('circle')
      .attr('r', d => {
        const targetNode = targets.find(t => t.members.includes(d.id));
        return targetNode ? 8 : 5;
      })
      .attr('fill', d => {
        const targetNode = targets.find(t => t.members.includes(d.id));
        if (targetNode) return targetNode.color;
        const community = nodeComm[d.id] !== undefined ? nodeComm[d.id] : 0;
        return this.PALETTE[community % this.PALETTE.length];
      })
      .attr('stroke', d => {
        const targetNode = targets.find(t => t.members.includes(d.id));
        return targetNode ? '#fff' : 'none';
      })
      .attr('stroke-width', 2)
      .attr('opacity', 0.9)
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Add hover tooltips
    node.on('mouseenter', (event, d) => {
      const tooltip = document.getElementById('tooltip');
      tooltip.textContent = `Node ${d.id}`;
      tooltip.style.display = 'block';
      tooltip.style.left = (event.pageX + 10) + 'px';
      tooltip.style.top = (event.pageY + 10) + 'px';
    }).on('mouseleave', () => {
      document.getElementById('tooltip').style.display = 'none';
    }).on('mousemove', (event) => {
      const tooltip = document.getElementById('tooltip');
      tooltip.style.left = (event.pageX + 10) + 'px';
      tooltip.style.top = (event.pageY + 10) + 'px';
    });

    // Update on simulation tick
    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x = Math.max(5, Math.min(width - 5, d.x)))
        .attr('cy', d => d.y = Math.max(5, Math.min(height - 5, d.y)));
    });
  },

  buildLegend(containerId, itemsId, nodeComm, targetIds = []) {
    const container = document.getElementById(containerId);
    const itemsContainer = document.getElementById(itemsId);
    
    if (!itemsContainer) return;

    const communities = new Set(Object.values(nodeComm));
    const comList = Array.from(communities).sort((a, b) => a - b);

    itemsContainer.innerHTML = '';
    comList.forEach(comm => {
      const color = this.PALETTE[comm % this.PALETTE.length];
      const isTarget = targetIds.includes(comm);
      const item = document.createElement('div');
      item.className = 'legend-item' + (isTarget ? ' target' : '');
      item.innerHTML = `
        <div class="legend-swatch" style="background:${color}"></div>
        <span class="legend-label">C${comm}</span>`;
      itemsContainer.appendChild(item);
    });

    container.style.display = comList.length > 0 ? 'block' : 'none';
  },

  buildTargetChips(containerId, targets) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    targets.forEach(t => {
      const chip = document.createElement('div');
      chip.className = 'target-chip';
      chip.style.setProperty('--chip-color', t.color);
      chip.innerHTML = `<span>C${t.commId}</span><span class="chip-size">${t.members.length}nodes</span>`;
      container.appendChild(chip);
    });
  },

  stopAll() {
    Object.values(this.sims).forEach(sim => {
      if (sim) sim.stop();
    });
    this.sims = {};
  }
};
