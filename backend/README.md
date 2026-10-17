# CityFlow AI — Python backend

Flask API for the FluxGRID / CityFlow AI dashboard (Team EchoBYTE).  
The in-memory traffic simulation is the source of truth for the dashboard. All traffic numbers from this service are **simulated** unless a response explicitly sets `dataProvenance` to `yolo-inference`.

Demonstration intersection coordinates are placed around Delhi, India. They are **not** live municipal sensors.

## Python requirements

- Python 3.10+ (Windows `py` launcher supported)
- Packages listed in `requirements.txt`: Flask, Flask-CORS, NumPy, pytest

OpenCV and Ultralytics YOLO/PyTorch are optional. The simulation, routing, and community-report API work without them.

## Windows installation

```bat
cd backend
py -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

For optional video inference, install the vision dependencies separately:

```bat
pip install -r requirements-vision.txt
```

If the optional vision packages or model weights are unavailable, detection reports `unavailable` while simulation, routing, and reports continue to work.

## Run the Flask server

```bat
cd backend
.venv\Scripts\activate
set CITYFLOW_ADMIN_EMAIL=admin@example.com
set CITYFLOW_ADMIN_PASSWORD=choose-a-unique-password-at-least-12-characters
python app.py
```

Default bind: `http://127.0.0.1:5000`
Set both admin variables before starting Flask to create the initial admin account. The account is stored in the SQLite database with a password hash; changing the environment password does not reset an existing account. Choose a private password locally and do not commit it.

Users can create user-role accounts from the dashboard's **Sign in / Sign up** page with their full name, email, verified phone number, city, and a password of at least 12 characters. Signup sends an SMS one-time code through Twilio Verify and creates the account only after the code is approved. Enter phone numbers in international format (for example, `+919876543210`). Configure Twilio Verify below before enabling signup; credentials belong only in the backend environment and must never be committed. FluxGRID does not collect Aadhaar information. The **Forgot password?** flow emails a one-time code and requires SMTP configuration. Accident reports submitted by signed-in users are visible with a **Pending** label until an admin approves or rejects them. Other report types remain immediately available.

Run the frontend in a **separate** terminal:

```bat
cd %USERPROFILE%\OneDrive\Desktop\FluxGRID
npm install
npm run dev
```

Frontend default: `http://localhost:5173`  
The Vite development server proxies `/api` requests to Flask on port 5000, so no `VITE_API_BASE_URL` is needed for local development. Set that variable only when the frontend must call a backend directly instead of using the Vite proxy.

Restart Vite after changing env vars. If the backend is down, the existing TypeScript simulation is used as fallback.

## Tests

```bat
cd backend
.venv\Scripts\activate
pytest
```

Ordinary unit tests do **not** download a YOLO model and do not require CUDA.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `CITYFLOW_HOST` | `127.0.0.1` | Bind address |
| `CITYFLOW_PORT` | `5000` | Bind port |
| `CITYFLOW_DEBUG` | `false` | Flask debug (reloader stays off) |
| `CITYFLOW_SESSION_SECRET` | Random per process | Flask session signing key; set a stable, private value to keep sessions valid after restart |
| `CITYFLOW_SESSION_COOKIE_SECURE` | `false` | Set `true` when the backend is served over HTTPS |
| `CITYFLOW_SMTP_HOST` | unset | SMTP server hostname for password-reset emails |
| `CITYFLOW_SMTP_PORT` | `587` | SMTP server port |
| `CITYFLOW_SMTP_USERNAME` | unset | Optional SMTP login username |
| `CITYFLOW_SMTP_PASSWORD` | unset | SMTP login password when authentication is enabled |
| `CITYFLOW_SMTP_FROM_EMAIL` | unset | Sender address for password-reset emails; required with SMTP host |
| `CITYFLOW_SMTP_STARTTLS` | `true` | Upgrade SMTP connections with STARTTLS |
| `CITYFLOW_PASSWORD_RESET_OTP_TTL_SECONDS` | `600` | Reset-code lifetime in seconds |
| `CITYFLOW_TWILIO_ACCOUNT_SID` | unset | Twilio account SID for SMS verification |
| `CITYFLOW_TWILIO_AUTH_TOKEN` | unset | Twilio API auth token; keep private |
| `CITYFLOW_TWILIO_VERIFY_SERVICE_SID` | unset | Twilio Verify service SID configured for SMS |
| `CITYFLOW_ADMIN_EMAIL` | unset | Email for one-time initial admin account bootstrap |
| `CITYFLOW_ADMIN_PASSWORD` | unset | Initial admin password (at least 12 characters); set together with admin email |
| `CITYFLOW_CORS_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Allowed frontend origins |
| `CITYFLOW_MIN_GREEN` | `10` | Prototype minimum green (s) |
| `CITYFLOW_MAX_GREEN` | `40` | Prototype maximum green (s) |
| `CITYFLOW_YELLOW_SECONDS` | `4` | Simulated yellow clearance (s) |
| `CITYFLOW_FIXED_GREEN` | `30` | Fixed-timing green (s) |
| `CITYFLOW_STARVATION_SECONDS` | `60` | Adaptive priority threshold |
| `CITYFLOW_ARRIVAL_SEED` | `42` | Reproducible arrivals |
| `CITYFLOW_COMPARE_DURATION` | `600` | Default comparison length (s) |
| `CITYFLOW_YOLO_MODEL_PATH` | `backend/models/weights/yolov8n.pt` | Local `.pt` weights |
| `CITYFLOW_YOLO_DEVICE` | `cpu` | `cpu` or `cuda` if available |
| `CITYFLOW_MAX_UPLOAD_BYTES` | `15728640` | Detection upload limit (~15 MB) |
| `CITYFLOW_DETECTION_FRAME_STRIDE` | `5` | Analyze every Nth frame |
| `CITYFLOW_DETECTION_MAX_FRAMES` | `240` | Cap processed frames |
| `CITYFLOW_REPORTS_DB_PATH` | `backend/data/traffic_reports.sqlite3` | SQLite database for community traffic reports |
| `CITYFLOW_REPORT_TTL_SECONDS` | `14400` | Report lifetime (4 hours) |
| `CITYFLOW_REPORT_MAX_DISTANCE_KM` | `5.0` | Maximum distance from a supported intersection |
| `CITYFLOW_ROUTING_BASE_URL` | `https://router.project-osrm.org` | OSRM-compatible routing endpoint |
| `CITYFLOW_ROUTING_TIMEOUT_SECONDS` | `8.0` | Routing service request timeout |
| `CITYFLOW_ROUTE_INTERSECTION_RADIUS_KM` | `2.5` | Simulation corridor matched against each route |

## YOLO weights (optional)

1. Download a small pretrained Ultralytics model yourself (for example `yolov8n.pt`).
2. Place it at `backend/models/weights/yolov8n.pt` **or** set `CITYFLOW_YOLO_MODEL_PATH`.
3. Restart the backend.

The server **does not** download weights on startup or when `/api/health` is called. GPU is used only if `CITYFLOW_YOLO_DEVICE` requests CUDA **and** `torch.cuda.is_available()` is true; otherwise inference stays on CPU.

## Simulation assumptions

- Four approaches: North, South, East, West.
- One-second discrete ticks.
- Poisson arrivals from approach rates (vehicles/hour ÷ 3600) × scenario multiplier, seeded RNG.
- Service: **0.5 veh/s** on green, **0.2 veh/s** on yellow (prototype saturation flow).
- Waiting time = `departure_time - arrival_time` for served vehicles.
- Two-phase signals: North–South green → yellow → East–West green → yellow. Conflicting greens are never issued.
- Adaptive control is **rule-based** (queue, wait, arrival rate, starvation threshold). It is **not** reinforcement learning.
- `balanced`, `peak_hour`, `uneven`, `changing` are API scenario IDs. The dashboard also sends existing IDs (`pm-peak`, `am-commute`, `rain-storm`, `incident-stall`, `special-event`).

These parameters are for the hackathon prototype, not recommendations for real roads.

## API

### `GET /api/health`

Does not load or download YOLO.

```json
{
  "status": "ok",
  "application": "CityFlow AI",
  "simulation": { "status": "paused", "simulatedClockSeconds": 0 },
  "yoloAvailable": true,
  "modelLoaded": false,
  "weightsAvailable": false
}
```

### `GET /api/intersections`

List of 12 demonstration intersections (Delhi-area coordinates).

### `GET /api/intersections/<id>`

Single intersection. Unknown ids return **404**.

### `GET /api/simulation/state`

Full dashboard snapshot: clock, mode, queues, phases, KPIs, metrics, performance series.

### `POST /api/simulation/start` · `pause` · `reset`

Start ticks, pause without wiping state, or restore the documented initial condition (clock 0, demo queues, metrics history cleared).

### `POST /api/simulation/mode`

```json
{ "mode": "adaptive", "intersectionId": "int-04" }
```

`mode` must be `fixed` or `adaptive`. Omit `intersectionId` to apply to every intersection.

### `POST /api/simulation/scenario`

```json
{ "scenario": "peak_hour" }
```

or `{ "scenarioId": "pm-peak" }`.

### `POST /api/simulation/step`

```json
{ "seconds": 10 }
```

Bounded by `CITYFLOW_MAX_STEP_SECONDS` (default 120).

### `POST /api/simulation/settings`

Accepts partial settings updates. Green and clearance values must be integers within the dashboard's safety-control ranges; sensitivity must be `conservative`, `balanced`, or `aggressive`. Invalid values and unknown setting names return **400** without changing the active settings.

```json
{
  "minGreenSeconds": 10,
  "maxGreenSeconds": 40,
  "clearanceSeconds": 4,
  "aiSensitivity": "balanced"
}
```

### `POST /api/simulation/compare`

Runs fixed vs adaptive on **identical** pre-generated arrivals.
`durationSeconds` must be an integer from 30 to 3600; optional `seed` must be an integer from 0 to 4294967295.

```json
{
  "identicalArrivals": true,
  "averageWaitingTimePctChange": -12.5,
  "summary": {
    "fixedAverageWaitingTime": 28.1,
    "adaptiveAverageWaitingTime": 24.6,
    "fixedMaxWaitingTime": 61,
    "adaptiveMaxWaitingTime": 54,
    "fixedMaxQueueLength": 12,
    "adaptiveMaxQueueLength": 9,
    "fixedAverageQueueSize": 3.2,
    "adaptiveAverageQueueSize": 2.7,
    "fixedVehiclesServed": 140,
    "adaptiveVehiclesServed": 151
  }
}
```

Percentage change is `(adaptive - fixed) / fixed`. Negative wait change means adaptive was lower. **Improvement is not guaranteed.**

### `GET /api/metrics` · `/api/metrics/history` · `/api/metrics/export`

Live metrics, chart history (`simTimeSeconds` plus a display `time` label), and CSV of genuine simulation rows.

### `GET` · `POST /api/traffic/reports`

Community traffic reports and accounts are stored in SQLite and survive backend restarts. Accident reports are visible as **pending** until an authenticated admin approves or rejects them; rejected accidents are hidden. Other report types are available immediately. Reports expire after four hours and are matched to the nearest supported intersection. Locations more than five kilometres from the demo network are rejected by default. Signup uses `POST /api/auth/signup/phone-verification` to send a code, then `POST /api/auth/signup` with `phoneVerificationCode` to verify and create the account. `POST /api/auth/login` and `/api/auth/logout` manage sessions; `GET /api/auth/me` returns the current account. Admin review uses `GET /api/admin/traffic/reports/pending` and `POST /api/admin/traffic/reports/<id>/decision` with `{"decision":"approve"}` or `{"decision":"reject"}`.

Submit a report with device coordinates:

```json
{
  "type": "accident",
  "latitude": 28.7041,
  "longitude": 77.1025,
  "description": "Two cars blocking the eastbound lane."
}
```

`type` must be `congestion`, `accident`, `roadwork`, `hazard`, or `closure`. Latitude and longitude are validated; the optional description is limited to 300 characters. `POST` returns the saved report and nearest intersection with HTTP **201**. `GET` returns only active reports.

### `GET /api/routing/places` · `POST /api/routing/plan`

The planner supports GTBIT, Connaught Place, IGI Airport, India Gate, and New Delhi Railway Station. It requests up to three road-route alternatives from the configured OSRM-compatible service and returns distance, typical route duration, a simulated congestion score, nearby community reports, and a CityFlow recommendation.

OpenStreetMap provides road geometry and typical travel time only. This application has **no live traffic-speed feed**; congestion is estimated from the demonstration simulation and unverified community reports. Trip endpoint coordinates are sent to the configured routing provider. If the provider is unavailable or cannot find a route, the API returns **502** instead of presenting a fabricated route.

### `GET /api/detection/status`

Enabled flag, weights on disk, model loaded, inference status. No download.

### `POST /api/detection/analyze`

`multipart/form-data` field `file` or `video`. Allowed extensions: `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`.  
Synchronous processing of a short clip. If weights are missing: **503** with an honest error. Invalid video: **400**. Temp files are deleted after processing. Internal paths are not returned.

Response includes processed frames, per-box detections (COCO car / motorcycle / bus / truck), class counts, confidences, timestamps, duration, and model status.

## Frontend connection

1. Backend on port 5000, frontend on 5173.
2. Vite proxies `/api` requests to Flask; no browser-visible backend URL or CORS setup is required.
3. `src/lib/apiClient.ts` talks to Flask. `TrafficContext` polls `/api/simulation/state` when healthy and otherwise uses the original TypeScript engine.

The dashboard layout is unchanged. Camera overlays remain a client-side visualization; class counts update from YOLO only after a successful analyze call.

## CORS and port conflicts

- CORS origins are explicit (not `*`). Add your origin to `CITYFLOW_CORS_ORIGINS` if Vite uses another host.
- Port 5000 in use: `set CITYFLOW_PORT=5001` and point `VITE_API_BASE_URL` at the new port.
- Port 5173 in use: change Vite `server.port` in `vite.config.ts`.
- For direct browser-to-backend access, use matching HTTP/HTTPS schemes and add the frontend origin to `CITYFLOW_CORS_ORIGINS`. The Vite proxy avoids this requirement during development.

## Limitations

- Not a microscopic / SUMO / VISSIM model.
- No pedestrians, turn pockets, or coordination offsets as engineering design.
- Network KPIs aggregate twelve independent four-approach toy intersections.
- CO₂ figures, when present, are **estimated from simulated waiting time**, not measured emissions.
- Video detections are frame samples of an uploaded file, not a live city camera.
- A missing YOLO file does not stop simulation.
