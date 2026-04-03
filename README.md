# UAV Telemetry Analysis and 3D Flight Visualization

Production-grade MVP for parsing Ardupilot `.BIN` logs, computing telemetry/metrics, converting to local ENU, and rendering a Cesium 3D trajectory with a Next.js dashboard.

## Stack

- Frontend: Next.js (App Router) + TypeScript + Tailwind + CesiumJS + Recharts + Zustand + TanStack Query
- Backend: FastAPI + pandas + numpy + pymavlink + pymap3d/pyproj
- Packaging: Dockerfiles for both apps, docker-compose orchestrator

## Local setup

### 1) Backend

```bash
python -m venv .venv
./.venv/Scripts/activate  # Windows
python -m pip install -r backend/requirements.txt
uvicorn app.main:app --reload --app-dir backend
```

### 2) Frontend

Install the extra runtime deps manually (keeps user control):

```bash
cd frontend
npm install --legacy-peer-deps
# if lockfile is stale after adding deps: npm install cesium @tanstack/react-query zustand recharts
npm run dev
```

Set API base if different from default:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_CESIUM_BASE_URL=https://cdn.jsdelivr.net/npm/cesium@1.120.0/Build/Cesium/
```

### 3) Docker

```bash
docker-compose up --build
```

Frontend on http://localhost:3000, backend on http://localhost:8000.

## API surface (v1)

- POST `/api/v1/flights/upload` — upload `.BIN`, parse, compute metrics
- GET `/api/v1/flights/{flight_id}` — flight metadata
- GET `/api/v1/flights/{flight_id}/telemetry` — normalized telemetry with ENU/acceleration + sensor sampling metadata
- GET `/api/v1/flights/{flight_id}/trajectory` — ENU polyline + origin
- GET `/api/v1/flights/{flight_id}/metrics` — summary metrics
- GET `/api/v1/flights/{flight_id}/analysis` — heuristic anomaly notes
- POST `/api/v1/flights/{flight_id}/ai-summary` — LLM summary (falls back to local rule-based summary if no key)

### Optional LLM setup for AI summary

Set these environment variables for live LLM analysis (OpenAI-compatible API):

```bash
LLM_API_KEY=<your_api_key>
LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_TIMEOUT_SEC=20
```

If `LLM_API_KEY` is not set, backend returns a deterministic fallback summary so the endpoint remains usable offline.

### Optional GPS outlier filter tuning

You can tune GPS glitch rejection thresholds via env vars:

```bash
GPS_OUTLIER_MAX_SEGMENT_M=1000
GPS_OUTLIER_MAX_SPEED_MPS=120
```

Lower values reject more aggressive jumps; higher values are more permissive.

## Implementation notes

- **Haversine**: `total_distance_m` sums segment distances via great-circle formula `2R * asin(sqrt(a))` using $a = \sin^2(\Delta\phi/2) + \cos\phi_1\cos\phi_2\sin^2(\Delta\lambda/2)$.
- **Trapezoidal integration**: velocity from acceleration via $v_i = v_{i-1} + 0.5 (a_i + a_{i-1}) \Delta t$, exposing integration drift explicitly.
- **WGS-84 → ENU**: use first valid GPS point as local tangent origin; `pymap3d.geodetic2enu` yields meters (x=East, y=North, z=Up).
- **IMU drift caution**: raw IMU integration can accumulate bias; only single integration is exposed and stays transparent in telemetry.
- **Parser**: `pymavlink` ingests Ardupilot `.BIN` GPS/IMU records; GPS lat/lon assumed 1e7-scaled degrees, alt in cm; IMU AccX/Y/Z treated as m/s².
- **Storage**: in-memory `InMemoryFlightStore` for MVP; files are persisted under `backend/data/uploads`.

## Testing

```bash
pytest backend/tests
```

Integration tests now include API contract checks against real `.BIN` files from `backend/data/uploads`.

## Next steps

- Swap AI stub with real LLM endpoint
- Persist flights (SQLite/Parquet) and add auth
- Add WebSocket progress + playback controls
- Harden log parsing against variant message names and unit scaling
