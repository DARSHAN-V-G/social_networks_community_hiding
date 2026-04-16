package hiding;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class CommunityDetection {

    private Graph graph;

    public CommunityDetection(Graph graph) {
        this.graph = graph;
    }

    public List<Set<Integer>> detectCommunities() {
        // A simple implementation of label propagation
        Map<Integer, Integer> communities = new HashMap<>();
        List<Integer> nodes = new ArrayList<>(graph.getAllNodes());

        // Initialize each node in its own community
        for (int node : nodes) {
            communities.put(node, node);
        }

        for (int i = 0; i < 10; i++) { // Iterate a few times to allow labels to propagate
            Collections.shuffle(nodes);
            for (int node : nodes) {
                Map<Integer, Integer> neighborCommunities = new HashMap<>();
                for (int neighbor : graph.getNeighbors(node)) {
                    int community = communities.get(neighbor);
                    neighborCommunities.put(community, neighborCommunities.getOrDefault(community, 0) + 1);
                }

                if (!neighborCommunities.isEmpty()) {
                    int maxCount = 0;
                    int bestCommunity = -1;
                    for (Map.Entry<Integer, Integer> entry : neighborCommunities.entrySet()) {
                        if (entry.getValue() > maxCount) {
                            maxCount = entry.getValue();
                            bestCommunity = entry.getKey();
                        }
                    }
                    communities.put(node, bestCommunity);
                }
            }
        }

        Map<Integer, Set<Integer>> finalCommunities = new HashMap<>();
        for (Map.Entry<Integer, Integer> entry : communities.entrySet()) {
            finalCommunities.computeIfAbsent(entry.getValue(), k -> new HashSet<>()).add(entry.getKey());
        }

        return new ArrayList<>(finalCommunities.values());
    }
}
