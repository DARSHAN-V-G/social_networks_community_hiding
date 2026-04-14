# Social Network Community Hiding Lab

Interactive web app for experimenting with community hiding in social networks using link perturbation.

This project provides:
- `Hs` for single-target community hiding.
- `MHs-Joint` for multi-target community hiding with a penalty term for inter-target coupling.
- Side-by-side BEFORE/AFTER graph visualization.
- Step-by-step perturbation explorer.
- H-score based evaluation summary.

## What This Project Does

Given a graph and one or more target communities, the app applies a limited number of edge additions/removals (budget $\beta$) to make the targets harder for community detection algorithms to isolate.

It supports:
- Loading prepackaged datasets or uploading your own `.txt`, `.csv`, or `.json` graph files.
- Running community detection with Louvain or Label Propagation.
- Running a hiding algorithm (`Hs` or `MHs-Joint`).
- Comparing graph structure and target deception before and after perturbation.

## Tech Stack

- Backend: Node.js + Express (`backend/server.js`)
- Frontend: Vanilla HTML/CSS/JS + D3.js (`frontend/`)
- Algorithms: custom JS implementations in `backend/`

## Repository Structure

```
backend/
  communityDetection.js
  graphLoader.js
  hsAlgorithm.js
  mhsAlgorithm.js
  safeness.js
  server.js
  datasets/

frontend/
  index.html
  css/style.css
  js/api.js
  js/app.js
  js/graph.js
  js/steps.js

sample/
  (reference data and experimental files)
```

## Quick Start

### 1. Prerequisites

- Node.js 18+ recommended
- npm

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Run the app

```bash
npm start
```

Server starts on `http://localhost:3001` and serves the frontend from the same process.

### 4. Development mode (auto-reload backend)

```bash
npm run dev
```

## Product Workflow

1. Load a dataset (preloaded or upload).
2. Run community detection on the BEFORE graph.
3. Select single or multiple target communities.
4. Choose parameters:
- Budget $\beta$ (max edge modifications).
- Penalty $\lambda$ (multi-target mode only).
5. Run hiding algorithm.
6. Inspect:
- BEFORE vs AFTER graph panels.
- Step explorer (candidate operations and chosen operation per step).
- Analysis tab (H-score and perturbation log).

## Core Concepts

### Safeness objective

For a target community $C$, the implementation uses a safeness score $\sigma(C)$ that combines internal dispersion and external connectivity.

Candidate operations are ranked by gain:

$$
\Delta\sigma = \sigma(\text{after}) - \sigma(\text{before})
$$

Only positive-gain operations are applied. If no positive candidate exists, the algorithm stops early.

### Single-target hiding (`Hs`)

`Hs` optimizes one target community.

Per iteration (up to budget):
- Generate edge ADD candidates from a target node to non-target nodes.
- Generate edge DEL candidates for intra-target edges that are not bridges.
- Pick the best positive-gain candidate.

Bridge edges are never deleted to preserve target connectivity.

### Multi-target hiding (`MHs-Joint`)

`MHs-Joint` optimizes average safeness across $k$ targets:

$$
\bar{\sigma} = \frac{1}{k}\sum_{i=1}^{k} \sigma(C_i)
$$

Each candidate gets a net score based on mean gain and optional penalty for linking two targets:

$$
\Delta\Phi = \frac{\Delta\sigma_i}{k} - \text{penalty}
$$

with penalty term controlled by $\lambda$.

## API Overview

Base URL: `http://localhost:3001`

### Health
- `GET /api/health`

### Dataset management
- `GET /api/datasets`
- `POST /api/load/preloaded` with `{ filename }`
- `POST /api/load/upload` (`multipart/form-data`, field: `file`)

### Detection
- `POST /api/detect`

Request body:
```json
{
  "nodes": [{ "id": 1 }],
  "links": [{ "source": 1, "target": 2 }],
  "algorithm": "louvain"
}
```

### Hiding
- `POST /api/hide/hs`
- `POST /api/hide/mhs`

Notes:
- Budget is clamped to max `30` in the backend.
- Supported detection algorithms: `louvain`, `lpa`.

## Data Formats

The loader accepts `.txt`, `.csv`, and `.json` graph files.

At runtime, graph data is normalized to:
- `nodes`: array of objects with `id`
- `links`: array of undirected edges with `source`, `target`

## Contributing (Without Changing Core Behavior)

If you want to contribute without touching algorithm logic or app behavior, here are high-value options:

1. Documentation improvements.
2. In-app text clarity (labels/tooltips/help copy).
3. Example datasets and dataset metadata docs.
4. Reproducible experiment notes in `sample/`.
5. UI accessibility improvements that do not alter flow.
6. Test cases around existing behavior (no logic changes).

Safe contribution checklist:
- Do not modify `backend/hsAlgorithm.js` or `backend/mhsAlgorithm.js` unless you intend algorithm changes.
- Keep API contract and response shape unchanged.
- Verify app still runs with `npm start`.
- Keep README and examples in sync with current behavior.

Suggested PR template:
- Scope: docs / examples / non-functional UI polish.
- Behavior impact: none.
- Validation: app launches, dataset load works, hide flow still executes.

## Known Constraints

- Budget is intentionally capped for interactive responsiveness.
- Very large graphs may be slow in browser visualization.
- Frontend currently expects backend on port `3001`.

## Script Commands

From `backend/`:

- `npm start` - run production server
- `npm run dev` - run with nodemon

## Version

Current backend API reports version `2.0.0`.

## Acknowledgment

This implementation follows the community-hiding-by-link-perturbation direction and includes single-target and joint multi-target variants for educational and experimental use.
