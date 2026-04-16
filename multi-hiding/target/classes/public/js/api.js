const API_URL = 'http://localhost:7070/api';

async function getGraphData(dataset) {
    const response = await fetch(`${API_URL}/graph?dataset=${dataset}`);
    return await response.json();
}

async function getCommunities(dataset) {
    const response = await fetch(`${API_URL}/communities?dataset=${dataset}`);
    return await response.json();
}

async function hideCommunities(dataset, communities, budget) {
    const response = await fetch(`${API_URL}/hide`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataset, communities, budget }),
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}