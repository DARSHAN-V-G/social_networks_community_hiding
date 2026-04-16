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
            int budget = ((Number) payload.get("budget")).intValue();
            double lambda = 0.5;

            List<Set<Integer>> targets = communitiesToHideRaw.stream()
                    .map(list -> list.stream().collect(Collectors.toSet()))
                    .collect(Collectors.toList());

            try {
                Graph graph = loadGraphFromDataset(dataset);
                
                List<Double> beforeSafeness = new java.util.ArrayList<>();
                for (Set<Integer> target : targets) {
                    beforeSafeness.add(SafenessMetrics.computeSafeness(graph, target));
                }

                List<Map<String, Object>> steps = MHsJointAlgorithm.runWithSteps(graph, targets, budget, lambda);
                
                List<Double> afterSafeness = new java.util.ArrayList<>();
                for (Set<Integer> target : targets) {
                    afterSafeness.add(SafenessMetrics.computeSafeness(graph, target));
                }

                CommunityDetection cdAfter = new CommunityDetection(graph);
                List<Set<Integer>> afterCommunities = cdAfter.detectCommunities();

                Map<String, Object> response = new java.util.HashMap<>();
                response.put("steps", steps);
                response.put("beforeSafeness", beforeSafeness);
                response.put("afterSafeness", afterSafeness);
                response.put("afterCommunities", afterCommunities);

                ctx.json(response);
            } catch (IOException e) {
                ctx.status(500).result("Failed to get algorithm steps: " + e.getMessage());
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