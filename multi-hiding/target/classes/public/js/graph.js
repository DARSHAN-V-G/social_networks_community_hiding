let networkBefore = null;
let networkAfter = null;

function drawGraph(containerId, graphData) {
    const container = document.getElementById(containerId);
    const data = {
        nodes: new vis.DataSet(graphData.nodes),
        edges: new vis.DataSet(graphData.edges),
    };
    const options = {
        nodes: {
            shape: 'circle',
            size: 16,
            font: { color: 'white', size: 14 }
        },
        physics: {
            forceAtlas2Based: {
                gravitationalConstant: -26,
                centralGravity: 0.005,
                springLength: 230,
                springConstant: 0.18,
            },
            maxVelocity: 146,
            solver: 'forceAtlas2Based',
            timestep: 0.35,
            stabilization: { iterations: 150 },
        },
    };
    if (containerId === 'graph-before') {
        networkBefore = new vis.Network(container, data, options);
        return networkBefore;
    } else {
        networkAfter = new vis.Network(container, data, options);
        return networkAfter;
    }
}

function colorNodesByCommunity(network, communities) {
    const nodes = network.body.data.nodes;
    const updates = [];
    const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'cyan', 'magenta'];
    let colorIndex = 0;
    for (const community of communities) {
        const color = colors[colorIndex % colors.length];
        for (const nodeId of community) {
            updates.push({ id: nodeId, color: color });
        }
        colorIndex++;
    }
    nodes.update(updates);
}

function highlightSelectedCommunities(network, selectedCommunities) {
    const nodes = network.body.data.nodes;
    const allNodeIds = nodes.getIds();
    const updates = [];

    // Reset borders without destroying background color
    allNodeIds.forEach(id => {
        updates.push({ id: id, borderWidth: 1, color: { border: '#ccc' } });
    });
    nodes.update(updates);
    updates.length = 0; // Clear the array

    // Highlight nodes in selected communities
    const selectedNodeIds = new Set();
    selectedCommunities.forEach(community => {
        community.forEach(nodeId => selectedNodeIds.add(nodeId));
    });

    selectedNodeIds.forEach(id => {
        // Just make their borders very thick and black to stand out
        updates.push({ id: id, borderWidth: 5, color: { border: '#000000' } });
    });

    nodes.update(updates);
}
