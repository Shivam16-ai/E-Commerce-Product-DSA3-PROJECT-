# E-Commerce Product Entity-Resolution & Matching Platform

React frontend + Python FastAPI backend, with JSON-file persistence and **no database**.

## Architecture

- `src/`: existing React 19 + TypeScript + Vite frontend
- `backend/main.py`: FastAPI REST API, product ingestion, similarity matching, analytics
- `backend/data/state.json`: persistent application state created automatically on first run
- Frontend calls the backend at `http://localhost:8000` by default. Override with `VITE_API_BASE_URL`.

## Requirements

- Node.js 20+ (compatible with the Vite version in this project)
- Python 3.10+

## Run locally (two terminals)

### Terminal 1 — Python backend

From the project root:

**Windows PowerShell**
```powershell
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m uvicorn main:app --reload --app-dir backend --host 127.0.0.1 --port 8000
```

**Ubuntu / macOS**
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn main:app --reload --app-dir backend --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000/docs` to test the API. Health check: `http://localhost:8000/api/health`.

### Terminal 2 — React frontend

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Implemented API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Backend and file-store health |
| GET | `/api/state` | Load saved app state |
| PUT | `/api/state` | Atomically persist app state |
| GET | `/api/products?q=sony` | Search/list products |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/{id}` | Update a product |
| DELETE | `/api/products/{id}` | Delete a product |
| POST | `/api/matching/compare` | Compare products and return scored candidates |
| POST | `/api/ingest/upload` | Validate CSV, JSON or XLSX and return a preview |
| GET | `/api/analytics/summary` | Compute metrics from saved state |

For ingestion, upload a file as multipart form field `file`. Preview is the default and does not change the catalog. To commit directly through the API, pass `?commit=true`. The frontend's upload page uses preview mode; pressing its existing commit-to-catalog action adds the reviewed records to app state, which is persisted by the API.

## Matching logic

The initial matching engine is explainable and dependency-light:
- normalized title similarity
- brand similarity
- model-number similarity
- shared product-attribute similarity
- exact UPC/GTIN treated as strong evidence
- configurable score threshold

It is a practical baseline, not a trained ML model. Image similarity is not computed by this version.

## No-database storage: important limitations

State is written to `backend/data/state.json` using atomic file replacement. This survives restarts on the same persistent disk. It is suitable for local demos, coursework and a single backend instance. It is **not** a substitute for a production database under heavy concurrent writes or multi-instance deployment. Back up the JSON file regularly. If deploying to a platform with an ephemeral filesystem, configure a persistent disk using `APP_DATA_DIR`; otherwise data may disappear on redeploy/restart.

This starter does not implement user accounts or role-based access control. Do not expose admin operations publicly without adding authentication and authorization. Configure `CORS_ORIGINS` to the exact frontend origin before deployment.

## Build checks

```bash
npm run lint
npm run build
python -m py_compile backend/main.py
```
