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
}