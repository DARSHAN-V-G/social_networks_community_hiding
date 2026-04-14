#include <bits/stdc++.h>
using namespace std;

unordered_map<int, vector<int>> graph;
unordered_map<int, int> label;

// Load graph
void loadGraph(string filename) {
    ifstream file(filename);
    string line;

    while (getline(file, line)) {
        if (line[0] == '#') continue;

        stringstream ss(line);
        int u, v;
        ss >> u >> v;

        graph[u].push_back(v);
        graph[v].push_back(u);

        if (label.find(u) == label.end()) label[u] = u;
        if (label.find(v) == label.end()) label[v] = v;
    }

    cout << "Graph loaded!" << endl;
    cout << "Nodes: " << graph.size() << endl;
}

// Label Propagation
void labelPropagation(int iterations = 10) {

    vector<int> nodes;

    for (auto &p : graph)
        nodes.push_back(p.first);

    for (int it = 0; it < iterations; it++) {

        random_shuffle(nodes.begin(), nodes.end());

        for (int node : nodes) {

            unordered_map<int,int> freq;

            for (int neigh : graph[node])
                freq[label[neigh]]++;

            int best_label = label[node];
            int max_count = 0;

            for (auto &f : freq) {
                if (f.second > max_count) {
                    max_count = f.second;
                    best_label = f.first;
                }
            }

            label[node] = best_label;
        }
    }
}

// Print communities
void saveCommunities() {

    unordered_map<int, vector<int>> communities;

    for (auto &p : label)
        communities[p.second].push_back(p.first);

    ofstream out("communities.txt");

    for (auto &c : communities) {

        for (int node : c.second)
            out << c.first << " " << node << endl;
    }

    out.close();

    cout << "Communities saved to communities.txt\n";
}

int main() {

    loadGraph("com-dblp.ungraph.txt");

    cout << "Running Label Propagation...\n";
    labelPropagation(10);

    saveCommunities();

    return 0;
}