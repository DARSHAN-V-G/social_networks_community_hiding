package hiding;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class Graph {

    private Map<Integer, Set<Integer>> adjacencyList;

    public Graph() {
        this.adjacencyList = new HashMap<>();
    }

    public void addNode(int nodeId) {
        adjacencyList.putIfAbsent(nodeId, new HashSet<>());
    }

    public void addEdge(int u, int v) {
        addNode(u);
        addNode(v);
        adjacencyList.get(u).add(v);
        adjacencyList.get(v).add(u); //assuming undirected
    }

    public void removeEdge(int u, int v) {
        if(adjacencyList.containsKey(u)) {
            adjacencyList.get(u).remove(v);
        }if(adjacencyList.containsKey(v)){
            adjacencyList.get(v).remove(u);
        }
    }

    public int getDegree(int nodeId){
        if(!adjacencyList.containsKey(nodeId)) { return 0; }
        return adjacencyList.get(nodeId).size();
    }

    public Set<Integer> getNeighbors(int nodeId) {
        if(!adjacencyList.containsKey(nodeId)){ return new HashSet<>(); }
        return new HashSet<>(adjacencyList.get(nodeId));
    }

    public Set<Integer> getAllNodes() {
        return adjacencyList.keySet();
    }

    public boolean hasEdge(int u, int v){
        return adjacencyList.containsKey(u) && adjacencyList.get(u).contains(v);
    }

    public Map<String, Object> toVisJsFormat() {
        Map<String, Object> visData = new HashMap<>();
        Set<Map<String, Object>> nodes = new HashSet<>();
        Set<Map<String, Object>> edges = new HashSet<>();

        for (Integer nodeId : adjacencyList.keySet()) {
            Map<String, Object> node = new HashMap<>();
            node.put("id", nodeId);
            node.put("label", String.valueOf(nodeId));
            node.put("font", Map.of("color", "white"));
            nodes.add(node);
        }

        Set<String> addedEdges = new HashSet<>();
        for (Map.Entry<Integer, Set<Integer>> entry : adjacencyList.entrySet()) {
            int u = entry.getKey();
            for (int v : entry.getValue()) {
                String edge1 = u + "-" + v;
                String edge2 = v + "-" + u;
                if (!addedEdges.contains(edge1) && !addedEdges.contains(edge2)) {
                    Map<String, Object> edge = new HashMap<>();
                    edge.put("from", u);
                    edge.put("to", v);
                    edges.add(edge);
                    addedEdges.add(edge1);
                }
            }
        }

        visData.put("nodes", nodes);
        visData.put("edges", edges);
        return visData;
    }
}