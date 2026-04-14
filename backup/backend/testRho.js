// testRho.js - A file to test the computeRho function.

// Instructions:
// 1. Modify the 'nodes', 'links', and 'communityMembers' variables below to define your graph.
// 2. Run this file from your terminal using: node backend/testRho.js
// 3. The script will print the generated adjacency list and the calculated Rho value.

const { linksToAdj, computeRho } = require('./safeness');

// --- 1. DEFINE YOUR GRAPH AND COMMUNITY HERE ---

// Define all node IDs in your graph.
const allNodeIds = [1, 2, 3, 4, 5, 6];

// Define the links (edges) between the nodes.
const links = [
  { source: 1, target: 2 },
  { source: 1, target: 3 },
  { source: 2, target: 3 },
  { source: 3, target: 4 }, // This is a "bridge" link between two parts of the graph
  { source: 4, target: 5 },
  { source: 4, target: 6 },
  { source: 5, target: 6 },
];

// Define the members of the community you want to calculate Rho for.
// This should be a subset of 'allNodeIds'.
const communityMembers = [1, 2, 3,4];


// --- 2. THE SCRIPT EXECUTES THE FUNCTIONS ---

console.log('--- Input Data ---');
console.log('Community Members:', communityMembers);
console.log('Links:', links);
console.log('--------------------\\n');

// Create a Set for the community members, as required by the functions.
const commSet = new Set(communityMembers);

// Create the adjacency list from the nodes and links.
const adj = linksToAdj(allNodeIds, links);

console.log('--- Generated Adjacency List ---');
// The adjacency list is a Map of Sets, so we convert it to a plain object for nice printing.
const adjForPrinting = {};
for (const nodeId in adj) {
  adjForPrinting[nodeId] = [...adj[nodeId]];
}
console.log(adjForPrinting);
console.log('--------------------------------\\n');


// Compute the Rho value for the specified community.
const rho = computeRho(adj, commSet);

console.log('--- Result ---');
console.log(`The computed Rho value for the community is: ${rho}`);
console.log('--------------');
