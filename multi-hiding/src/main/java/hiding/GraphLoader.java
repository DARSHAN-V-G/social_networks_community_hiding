package hiding;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

public class GraphLoader {

    // Main entry point to load a graph. It routes to the correct parser.
    public static Graph loadGraph(String filePath) throws IOException {
        Graph graph = new Graph();
        List<String> lines = Files.readAllLines(Paths.get(filePath));

        if (filePath.toLowerCase().endsWith(".gml")) {
            loadGML(lines, graph);
        } else if (filePath.toLowerCase().endsWith(".txt") || filePath.toLowerCase().endsWith(".csv")) {
            loadEdgeList(lines, graph, filePath.toLowerCase().endsWith(".csv") ? "," : "\\s+");
        } else {
            throw new IllegalArgumentException("Unsupported file format. Please use .gml, .txt, or .csv");
        }

        return graph;
    }

    // The State Machine for parsing Newman-style GML files
    private static void loadGML(List<String> lines, Graph graph) {
        boolean insideEdge = false;
        int currentSource = -1;
        int currentTarget = -1;

        for (String line : lines) {
            // Trim removes leading/trailing spaces and tabs, making matching exact.
            line = line.trim(); 
            
            // Trigger: We found an edge block. Sometimes it's "edge", sometimes "edge ["
            if (line.equals("edge") || line.startsWith("edge [") || line.equals("edge[")) {
                insideEdge = true;
                currentSource = -1;
                currentTarget = -1;
            } 
            // If we are inside an edge block, look for the source ID
            else if (insideEdge && line.startsWith("source")) {
                String[] parts = line.split("\\s+"); // Splits by any amount of whitespace
                currentSource = Integer.parseInt(parts[1]);
            } 
            // If we are inside an edge block, look for the target ID
            else if (insideEdge && line.startsWith("target")) {
                String[] parts = line.split("\\s+");
                currentTarget = Integer.parseInt(parts[1]);
            } 
            // Trigger: The edge block is closing
            else if (insideEdge && line.equals("]")) {
                // If we successfully found both nodes, add them to our Graph object
                if (currentSource != -1 && currentTarget != -1) {
                    graph.addEdge(currentSource, currentTarget);
                }
                // Reset state so we don't accidentally read node IDs as edge IDs
                insideEdge = false; 
            }
        }
    }

    // The parser for standard edge list formats (.txt or .csv)
    private static void loadEdgeList(List<String> lines, Graph graph, String delimiter) {
        for (String line : lines) {
            line = line.trim();
            
            // Skip empty lines or metadata comments
            if (line.isEmpty() || line.startsWith("#") || line.startsWith("%")) {
                continue;
            }

            String[] parts = line.split(delimiter);
            if (parts.length >= 2) {
                try {
                    int u = Integer.parseInt(parts[0].trim());
                    int v = Integer.parseInt(parts[1].trim());
                    graph.addEdge(u, v);
                } catch (NumberFormatException e) {
                    // Gracefully ignore header rows like "Source, Target"
                }
            }
        }
    }
}