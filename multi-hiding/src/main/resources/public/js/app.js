document.addEventListener('DOMContentLoaded', () => {
    const loadGraphBtn = document.getElementById('load-graph');
    const hideCommunitiesBtn = document.getElementById('hide-communities');
    const stepByStepBtn = document.getElementById('step-by-step');
    const runFullBtn = document.getElementById('run-full');
    const datasetSelect = document.getElementById('dataset');
    const communityListDiv = document.getElementById('community-list');
    const budgetInput = document.getElementById('budget');
    const edgeChangeList = document.getElementById('edge-change-list');

    let communities = [];
    let originalGraphData = null;
    let algorithmSteps = [];
    let currentStep = 0;
    let afterDataTemp = null;

    loadGraphBtn.addEventListener('click', async () => {
        const dataset = datasetSelect.value;
        originalGraphData = await getGraphData(dataset);
        drawGraph('graph-before', originalGraphData);
        communities = await getCommunities(dataset);
        displayCommunities(communities);
        colorNodesByCommunity(networkBefore, communities);
        
        // Clear the after graph and edge changes
        document.getElementById('graph-after').innerHTML = '';
        edgeChangeList.innerHTML = '';
        document.getElementById('safeness-info').style.display = 'none';
        stepByStepBtn.disabled = true;
        runFullBtn.disabled = true;
    });

    hideCommunitiesBtn.addEventListener('click', async () => {
        const dataset = datasetSelect.value;
        const selectedCommunities = getSelectedCommunities();
        if (selectedCommunities.length === 0) {
            alert('Please select at least one community to hide.');
            return;
        }
        const budget = parseInt(budgetInput.value);
        
        highlightSelectedCommunities(networkBefore, selectedCommunities);

        const responseObj = await hideCommunities(dataset, selectedCommunities, budget);
        algorithmSteps = responseObj.steps || [];
        afterDataTemp = responseObj; // Store to use later
        
        currentStep = 0;
        stepByStepBtn.disabled = false;
        runFullBtn.disabled = false;
        document.getElementById('safeness-info').style.display = 'none';

        // Draw the initial state in the "after" graph
        drawGraph('graph-after', originalGraphData);
        colorNodesByCommunity(networkAfter, communities);
        edgeChangeList.innerHTML = '';
    });

    stepByStepBtn.addEventListener('click', () => {
        if (currentStep < algorithmSteps.length) {
            applyStep(algorithmSteps[currentStep]);
            currentStep++;
        }
        if (currentStep >= algorithmSteps.length) {
            finishAlgorithm();
        }
    });

    runFullBtn.addEventListener('click', () => {
        while (currentStep < algorithmSteps.length) {
            applyStep(algorithmSteps[currentStep]);
            currentStep++;
        }
        finishAlgorithm();
    });

    function getTargetNodes(communitiesToHide) {
        const set = new Set();
        communitiesToHide.forEach(comm => comm.forEach(n => set.add(n)));
        return set;
    }

    function finishAlgorithm() {
        stepByStepBtn.disabled = true;
        runFullBtn.disabled = true;
        
        // Show safeness scores
        const safenessInfo = document.getElementById('safeness-info');
        const safenessDetails = document.getElementById('safeness-details');
        safenessInfo.style.display = 'block';

        let htmlStr = "<ul>";
        for(let i=0; i<afterDataTemp.beforeSafeness.length; i++) {
            let before = afterDataTemp.beforeSafeness[i].toFixed(4);
            let after = afterDataTemp.afterSafeness[i].toFixed(4);
            let diff = (after - before).toFixed(4);
            htmlStr += `<li>Target ${i+1}: <b>${before}</b> ➔ <b>${after}</b> (Change: ${diff})</li>`;
        }
        htmlStr += "</ul>";
        safenessDetails.innerHTML = htmlStr;

        // Recolor notes by newly detected communities in the after graph
        if (afterDataTemp.afterCommunities) {
            colorNodesByCommunity(networkAfter, afterDataTemp.afterCommunities);

            // Highlight nodes that "hid" (changed community size/composition) by reshaping them.
            // A simple heuristic for successful hiding: map each new community to an old one by max intersection.
            // Nodes outside the mapped community will have a different shape to stand out.
            const targetNodes = getTargetNodes(getSelectedCommunities());
            const oldCommsMap = new Map();
            communities.forEach((comm, idx) => comm.forEach(n => oldCommsMap.set(n, idx)));
            
            const nodesAfter = networkAfter.body.data.nodes;
            const updates = [];
            afterDataTemp.afterCommunities.forEach((newComm, newIdx) => {
                const oldCounts = {};
                newComm.forEach(n => {
                    const oldIdx = oldCommsMap.get(n);
                    oldCounts[oldIdx] = (oldCounts[oldIdx] || 0) + 1;
                });
                
                // Find majority old community for this new community
                let majorityOldIdx = -1;
                let maxCount = 0;
                for (const oldIdx in oldCounts) {
                    if (oldCounts[oldIdx] > maxCount) {
                        maxCount = oldCounts[oldIdx];
                        majorityOldIdx = parseInt(oldIdx);
                    }
                }

                // If a target node ended up not in the majority old community group, it's "hidden"!
                newComm.forEach(n => {
                    if (targetNodes.has(n)) {
                        const originalOldIdx = oldCommsMap.get(n);
                        if (originalOldIdx !== majorityOldIdx) {
                            updates.push({ id: n, shape: 'star', size: 25, title: 'Successfully Hidden!' });
                        }
                    }
                });
            });
            nodesAfter.update(updates);

            alert('Algorithm completed. Hidden nodes (separated from their original community core) are now shaped like stars!');
        } else {
            alert('All steps completed.');
        }
    }

    function applyStep(step) {
        const edges = networkAfter.body.data.edges;
        const li = document.createElement('li');
        if (step.type === 'ADD') {
            // New edge added: make it bold, dashed green
            edges.add({ 
                from: step.u, 
                to: step.v, 
                color: { color: '#2ecc71', highlight: '#00ff00' },
                dashes: [5, 5],
                width: 3 
            });
            li.textContent = `ADD (${step.u}, ${step.v})`;
            li.className = 'added';
        } else {
            // Removed edge: make it faint, dashed red, and disable force simulation
            const edge = edges.get({
                filter: item => (item.from === step.u && item.to === step.v) || (item.from === step.v && item.to === step.u)
            });
            if (edge.length > 0) {
                edges.update({ 
                    id: edge[0].id, 
                    color: { color: '#e74c3c', highlight: '#ff0000', opacity: 0.4 },
                    dashes: [2, 5],
                    width: 2,
                    physics: false
                });
            }
            li.textContent = `REMOVE (${step.u}, ${step.v})`;
            li.className = 'removed';
        }
        edgeChangeList.appendChild(li);
    }

    function displayCommunities(communities) {
        communityListDiv.innerHTML = '';
        communities.forEach((community, index) => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `community-${index}`;
            checkbox.value = index;
            const label = document.createElement('label');
            label.htmlFor = `community-${index}`;
            label.textContent = `Community ${index + 1} (${community.length} members)`;
            const br = document.createElement('br');
            communityListDiv.appendChild(checkbox);
            communityListDiv.appendChild(label);
            communityListDiv.appendChild(br);
        });
    }

    function getSelectedCommunities() {
        const selected = [];
        const checkboxes = communityListDiv.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selected.push(communities[parseInt(checkbox.value)]);
            }
        });
        return selected;
    }
});