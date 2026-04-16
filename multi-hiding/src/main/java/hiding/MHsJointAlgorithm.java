package hiding;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
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

    public static int run(Graph graph, List<Set<Integer>> targets, int budget, double lambda) {
        int k = targets.size();
        if (k == 0) return 0;

        int removedEdges = 0;

        // Create a master set of ALL target nodes so we can quickly check for cross-contamination
        Set<Integer> allTargetNodes = new HashSet<>();
        for (Set<Integer> target : targets) {
            allTargetNodes.addAll(target);
        }

        System.out.println("Starting MHs-Joint with Budget: " + budget + ", Lambda: " + lambda);

        for (int b = 0; b < budget; b++) {
            Move bestMove = null;

            // Evaluate moves for EVERY target community
            for (int ti = 0; ti < k; ti++) {
                Set<Integer> comm = targets.get(ti);

                // ==========================================
                // 1. Evaluate inter-C ADDITIONS
                // ==========================================
                int bestAddNode = -1;
                double minRatio = Double.MAX_VALUE;

                // Find the node in this community most desperate for outside connection
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

                    // Try connecting it to nodes outside the community
                    for (int v : graph.getAllNodes()) {
                        if (comm.contains(v) || graph.hasEdge(u, v)) continue;

                        // Theorem 1 shortcut from the paper: theoretical gain without full recalculation
                        double dSig = (degree > 0) ? 0.5 * (degree - externalLinks) / (double) (degree * (degree + 1)) : 0.0;
                        double meanGain = dSig / k;

                        // Apply Penalty if 'v' belongs to a DIFFERENT target community
                        double penalty = 0.0;
                        if (allTargetNodes.contains(v) && !comm.contains(v)) {
                            penalty = lambda / Math.max(1, k - 1);
                        }

                        double finalScore = meanGain - penalty;

                        if (bestMove == null || finalScore > bestMove.score) {
                            bestMove = new Move("ADD", u, v, ti, finalScore, penalty);
                        }
                    }
                }

                // ==========================================
                // 2. Evaluate intra-C DELETIONS
                // ==========================================
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
                    
                    // Theorem 2 shortcut: theoretical gain for deletion
                    double dSig = 0.5 / k;
                    double finalScore = dSig; // No penalty for deletions

                    if (bestMove == null || finalScore > bestMove.score) {
                        bestMove = new Move("DEL", u, v, ti, finalScore, 0.0);
                    }
                }
            }

            // ==========================================
            // 3. EXECUTE THE BEST MOVE FOR THIS ITERATION
            // ==========================================
            if (bestMove != null) {
                if (bestMove.type.equals("ADD")) {
                    graph.addEdge(bestMove.u, bestMove.v);
                    System.out.printf("Budget %d/%d: ADD edge (%d, %d) for Target %d. Score: %.4f (Penalty: %.4f)\n",
                            b + 1, budget, bestMove.u, bestMove.v, bestMove.targetIndex, bestMove.score, bestMove.penalty);
                } else { // DEL
                    graph.removeEdge(bestMove.u, bestMove.v);
                    removedEdges++;
                    System.out.printf("Budget %d/%d: DEL edge (%d, %d) for Target %d. Score: %.4f\n",
                            b + 1, budget, bestMove.u, bestMove.v, bestMove.targetIndex, bestMove.score);
                }
            } else {
                System.out.println("No profitable move found. Stopping early.");
                break; // No more improvements can be made
            }
        }
        return removedEdges;
    }
}