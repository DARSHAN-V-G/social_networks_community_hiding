package hiding;

import java.util.HashSet;
import java.util.LinkedList;
import java.util.Queue;
import java.util.Set;

public class SafenessMetrics {

    // Calculates the Total Community Safeness: σ(C)
    public static double computeSafeness(Graph graph, Set<Integer> community) {
        if (community.isEmpty() || community.size() == 1) return 0.0;
        
        double psi = computePsi(graph, community);
        double phi = computePhi(graph, community);
        
        return 0.5 * psi + 0.5 * phi;
    }

    // Calculates Inter-Community Spread: φ(C)
    public static double computePhi(Graph graph, Set<Integer> community) {
        double phi = 0.0;
        
        for (int u : community) {
            int totalDegree = graph.getDegree(u);
            if (totalDegree == 0) continue;
            
            // Count how many neighbors are OUTSIDE the community
            int externalLinks = 0;
            for (int neighbor : graph.getNeighbors(u)) {
                if (!community.contains(neighbor)) {
                    externalLinks++;
                }
            }
            
            phi += (double) externalLinks / totalDegree;
        }
        return phi;
    }

    // Calculates Intra-Community Dispersion: ψ(C)
    public static double computePsi(Graph graph, Set<Integer> community) {
        int n = community.size();
        if (n <= 1) return 0.0;

        // 1. Calculate raw sum of shortest paths within the community subgraph: ρ(C)
        double rawRho = calculateRawRho(graph, community);

        // 2. Calculate theoretical min and max bounds based on paper's formulas
        // Min bound: 2 * (n - 1)^2 (Star graph structure)
        double rhoMin = 2.0 * Math.pow(n - 1, 2);

        // Max bound: Summation formula for a line graph structure
        double rhoMax = 0.0;
        for (int k = 1; k <= n; k++) {
            double sum1 = 0;
            for (int i = 1; i <= n - k; i++) sum1 += i;
            
            double sum2 = 0;
            for (int j = 0; j <= k - 1; j++) sum2 += j;
            
            rhoMax += (sum1 + sum2);
        }

        // Handle edge case where max equals min to avoid division by zero
        if (rhoMax == rhoMin) return 0.0;

        // 3. Normalize the score
        double psi = (rawRho - rhoMin) / (rhoMax - rhoMin);
        
        // Ensure bounds [0, 1] due to potential floating point quirks
        return Math.max(0.0, Math.min(1.0, psi));
    }

    // Helper: Runs Breadth-First Search (BFS) to find shortest paths ONLY within the community
    private static double calculateRawRho(Graph graph, Set<Integer> community) {
        double totalPathLength = 0;

        for (int startNode : community) {
            Queue<Integer> queue = new LinkedList<>();
            Set<Integer> visited = new HashSet<>();
            
            // Track distances from the startNode
            java.util.Map<Integer, Integer> distances = new java.util.HashMap<>();
            
            queue.add(startNode);
            visited.add(startNode);
            distances.put(startNode, 0);

            while (!queue.isEmpty()) {
                int current = queue.poll();
                int currentDist = distances.get(current);

                for (int neighbor : graph.getNeighbors(current)) {
                    // Only traverse if the neighbor is actually IN the target community
                    if (community.contains(neighbor) && !visited.contains(neighbor)) {
                        visited.add(neighbor);
                        distances.put(neighbor, currentDist + 1);
                        queue.add(neighbor);
                        
                        // We add the distance to our total pool
                        totalPathLength += (currentDist + 1);
                    }
                }
            }
        }
        return totalPathLength;
    }

    // Utility: Checks if deleting edge (u, v) breaks the community into separate pieces
    public static boolean isBridge(Graph graph, int u, int v, Set<Integer> community) {
        // Temporarily remove the edge
        graph.removeEdge(u, v);
        
        // Try to reach 'v' starting from 'u' using only nodes in the community
        boolean canReach = false;
        Queue<Integer> queue = new LinkedList<>();
        Set<Integer> visited = new HashSet<>();
        
        queue.add(u);
        visited.add(u);
        
        while (!queue.isEmpty()) {
            int current = queue.poll();
            if (current == v) {
                canReach = true;
                break;
            }
            
            for (int neighbor : graph.getNeighbors(current)) {
                if (community.contains(neighbor) && !visited.contains(neighbor)) {
                    visited.add(neighbor);
                    queue.add(neighbor);
                }
            }
        }
        
        // Put the edge back! This is critical so we don't accidentally ruin the graph state.
        graph.addEdge(u, v);
        
        // If we COULD NOT reach v, it means the edge was a bridge holding the community together.
        return !canReach;
    }
}