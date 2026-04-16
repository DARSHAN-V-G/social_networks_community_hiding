package hiding;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.Javalin;
import io.javalin.http.staticfiles.Location;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public class Main {
    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static void main(String[] args) {
        Javalin app = Javalin.create(config -> {
            config.addStaticFiles("/public", Location.CLASSPATH);
            config.enableCorsForAllOrigins();
        }).start(7070);

        System.out.println("Server started at http://localhost:7070");

        app.get("/api/graph", ctx -> {
            String dataset = ctx.queryParam("dataset");
            if (dataset == null) {
                ctx.status(400).result("Dataset parameter is required");
                return;
            }
            try {
                Graph graph = loadGraphFromDataset(dataset);
                ctx.json(graph.toVisJsFormat());
            } catch (IOException e) {
                ctx.status(500).result("Failed to load graph: " + e.getMessage());
            }
        });

        app.get("/api/communities", ctx -> {
            String dataset = ctx.queryParam("dataset");
            if (dataset == null) {
                ctx.status(400).result("Dataset parameter is required");
                return;
            }
            try {
                Graph graph = loadGraphFromDataset(dataset);
                CommunityDetection cd = new CommunityDetection(graph);
                List<Set<Integer>> communities = cd.detectCommunities();
                ctx.json(communities);
            } catch (IOException e) {
                ctx.status(500).result("Failed to load graph for community detection: " + e.getMessage());
            }
        });

        app.post("/api/hide", ctx -> {
            String body = ctx.body();
            Map<String, Object> payload = objectMapper.readValue(body, Map.class);

            String dataset = (String) payload.get("dataset");
            List<List<Integer>> communitiesToHideRaw = (List<List<Integer>>) payload.get("communities");
            int budget = (int) payload.get("budget");
            double lambda = 0.5; // Or get from payload if you want it to be configurable

            List<Set<Integer>> targets = communitiesToHideRaw.stream()
                    .map(list -> (Set<Integer>) list.stream().collect(Collectors.toSet()))
                    .collect(Collectors.toList());

            try {
                Graph graph = loadGraphFromDataset(dataset);
                int removedEdges = MHsJointAlgorithm.run(graph, targets, budget, lambda);
                ctx.json(Map.of("removed_edges", removedEdges));
            } catch (IOException e) {
                ctx.status(500).result("Failed to run hiding algorithm: " + e.getMessage());
            }
        });
    }

    private static Graph loadGraphFromDataset(String dataset) throws IOException {
        String filePath = "";
        switch (dataset) {
            case "karate":
                filePath = "datasets/karate.gml";
                break;
            case "football":
                filePath = "datasets/football.gml";
                break;
            case "dolphin":
                filePath = "datasets/dolphins.gml";
                break;
            case "lesmis":
                // Assuming you have this dataset, if not, you need to add it.
                // For now, let's reuse another one as a placeholder.
                filePath = "datasets/polbooks.gml";
                break;
            default:
                throw new IOException("Unknown dataset: " + dataset);
        }
        return GraphLoader.loadGraph(filePath);
    }
}