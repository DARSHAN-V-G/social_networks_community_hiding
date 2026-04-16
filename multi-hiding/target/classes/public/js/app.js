document.addEventListener('DOMContentLoaded', () => {
    const loadGraphBtn = document.getElementById('load-graph');
    const hideCommunitiesBtn = document.getElementById('hide-communities');
    const datasetSelect = document.getElementById('dataset');
    const communityListDiv = document.getElementById('community-list');
    const budgetInput = document.getElementById('budget');

    let communities = [];

    loadGraphBtn.addEventListener('click', async () => {
        const dataset = datasetSelect.value;
        const graphData = await getGraphData(dataset);
        drawGraph(graphData);
        communities = await getCommunities(dataset);
        displayCommunities(communities);
        colorNodesByCommunity(communities);
    });

    hideCommunitiesBtn.addEventListener('click', async () => {
        const dataset = datasetSelect.value;
        const selectedCommunities = getSelectedCommunities();
        const budget = parseInt(budgetInput.value);
        const result = await hideCommunities(dataset, selectedCommunities, budget);
        alert(`Hiding process completed. Edges removed: ${result.removed_edges}`);
        const graphData = await getGraphData(dataset);
        drawGraph(graphData);
    });

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
