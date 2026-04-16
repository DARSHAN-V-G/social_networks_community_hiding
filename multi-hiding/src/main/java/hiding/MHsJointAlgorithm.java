package hiding;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class MHsJointAlgorithm {

    // A simple helper class to keep track of the best move during our budget loop
    private static class Move {
        String type; // "ADD" or "DEL"
        int u, v;
        int targetIndex;
        double score; // The final adjusted score (gain - penalty)
        double penalty;

        Move(String type, int u, int v, int targetIndex, double score, double penalty) {
            this.type = type;
            this.u = u;
            this.v = v;
            this.targetIndex = targetIndex;
            this.score = score;
            this.penalty = penalty;
        }
    }

    public static List<Map<String, Object>> runWithSteps(Graph graph, List<Set<Integer>> targets, int budget, double lambda) {
        List<Map<String, Object>> steps = new ArrayList<>();
        int k = targets.size();
        if (k == 0) return steps;

        Set<Integer> allTargetNodes = new HashSet<>();
        for (Set<Integer> target : targets) {
            allTargetNodes.addAll(target);
        }

        int[] moveCounts = new int[k];

        for (int b = 0; b < budget; b++) {
            Move bestMove = null;

            for (int ti = 0; ti < k; ti++) {
                Set<Integer> comm = targets.get(ti);

                // Evaluate ADDITIONS
                int bestAddNode = -1;
                double minRatio = Double.MAX_VALUE;
                for (int u : comm) {
                    int degree = graph.getDegree(u);
                    if (degree == 0) continue;
                    int externalLinks = 0;
                    for (int neighbor : graph.getNeighbors(u)) {
                        if (!comm.contains(neighbor)) externalLinks++;
                    }
                    double ratio = (double) externalLinks / degree;
                    if (ratio < minRatio) {
                        minRatio = ratio;
                        bestAddNode = u;
                    }
                }

                if (bestAddNode != -1) {
                    int u = bestAddNode;
                    int degree = graph.getDegree(u);
                    int externalLinks = (int) Math.round(minRatio * degree);
                    for (int v : graph.getAllNodes()) {
                        if (comm.contains(v) || graph.hasEdge(u, v)) continue;
                        double dSig = (degree > 0) ? 0.5 * (degree - externalLinks) / (double) (degree * (degree + 1)) : 0.0;
                        double meanGain = dSig / k;
                        double penalty = 0.0;
                        if (allTargetNodes.contains(v) && !comm.contains(v)) {
                            penalty = lambda / Math.max(1, k - 1);
                        }
                        double finalScore = meanGain - penalty - (1e-6 * moveCounts[ti]); // small penalty to ensure fairness
                        
                        if (bestMove == null || finalScore > bestMove.score) {
                            bestMove = new Move("ADD", u, v, ti, finalScore, penalty);
                        }
                    }
                }

                // Evaluate DELETIONS
                List<int[]> internalEdges = new ArrayList<>();
                for (int u : comm) {
                    for (int v : graph.getNeighbors(u)) {
                        if (u < v && comm.contains(v)) {
                            internalEdges.add(new int[]{u, v});
                        }
                    }
                }

                for (int[] edge : internalEdges) {
                    int u = edge[0];
                    int v = edge[1];
                    double dSig = 0.5 / k;
                    double finalScore = dSig - (1e-6 * moveCounts[ti]); // small penalty to ensure fairness
                    
                    if (bestMove == null || finalScore > bestMove.score) {
                        bestMove = new Move("DEL", u, v, ti, finalScore, 0.0);
                    }
                }
            }

            if (bestMove != null) {
                moveCounts[bestMove.targetIndex]++;
                Map<String, Object> step = new HashMap<>();
                step.put("type", bestMove.type);
                step.put("u", bestMove.u);
                step.put("v", bestMove.v);
                steps.add(step);

                if (bestMove.type.equals("ADD")) {
                    graph.addEdge(bestMove.u, bestMove.v);
                } else {
                    graph.removeEdge(bestMove.u, bestMove.v);
                }
            } else {
                break;
            }
        }
        return steps;
    }
}