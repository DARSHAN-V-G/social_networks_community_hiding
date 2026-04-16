let network = null;

function drawGraph(graphData) {
    const container = document.getElementById('graph-container');
    const data = {
        nodes: new vis.DataSet(graphData.nodes),
        edges: new vis.DataSet(graphData.edges),
    };
    const options = {
        nodes: {
            shape: 'dot',
            size: 16,
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
    network = new vis.Network(container, data, options);
}

function colorNodesByCommunity(communities) {
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
