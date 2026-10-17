# FluxGRID · CityFlow AI — Adaptive Traffic Intelligence

> **Smart City & Mobility Project by Team EchoBYTE**
> A dark operations-centre dashboard for real-time traffic monitoring, computer vision telemetry, and adaptive signal timing optimization.

---

## 🌟 Overview & Visual Fidelity

This application is a desktop-first **FluxGRID / CityFlow AI** traffic operations dashboard. It combines a local traffic simulation with a Flask API for simulation controls and persistent community incident reports.

### Key Visual Characteristics
- **Dark Operations-Centre Theme**: Deep navy backgrounds (`#080F1B`, `#0B1422`, `#111C2B`), crisp slate-blue borders (`#243449`), and cyan accents (`#31D7E8`).
- **Compact High-Density Layout**: Space-efficient technical typography (Inter & JetBrains Mono), compact metric cards, and responsive grids.
- **Color-Coded Statuses**: Green (`#39D9A5` for Clear/Passed), Amber (`#F4B84A` for Moderate/Warning), and Red (`#FF647C` for Heavy Congestion).
- **Interactive Map Options**: Toggle between the **Downtown Digital Twin Schematic Grid** (exact match to the reference screenshot) and **MapLibre GL JS OpenFreeMap Liberty** (Delhi NCR GPS coordinates `[77.1025, 28.7041]`).

---

## 🚀 Technology Stack

- **Framework**: React 18 with TypeScript
- **Bundler & Dev Server**: Vite
- **Styling**: Tailwind CSS with custom operations-centre palette
- **Icons**: Lucide React
- **Data Visualizations**: Recharts
- **Interactive Mapping**: MapLibre GL JS + OpenFreeMap Liberty Vector Tiles
- **Computer Vision Simulation**: HTML5 Canvas with simulated multi-class bounding boxes & local video upload support

---

## 🗂 Architecture & Component Hierarchy

```
FluxGRID/
├── index.html                   # HTML template with Google Fonts & MapLibre CSS
├── package.json                 # Dependencies & scripts
├── vite.config.ts               # Vite configuration
├── tailwind.config.js           # Operations palette & fonts
├── src/
│   ├── types/
│   │   └── traffic.ts           # Intersections, approaches, phases & telemetry interfaces
│   ├── lib/
│   │   ├── demoData.ts          # Baseline values, 12 intersections (Delhi), scenarios
│   │   ├── trafficController.ts # Webster-based adaptive green-time rebalancing algorithm
│   │   ├── simulationEngine.ts  # Deterministic traffic queue, arrival, & countdown loop
│   │   └── exportCsv.ts         # CSV exporter for network KPIs & intersection data
│   ├── context/
│   │   └── TrafficContext.tsx   # Global reactive state & simulation timer loop
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx      # Navigation, simulation status, & EchoBYTE branding
│   │   │   └── Header.tsx       # Breadcrumb, DEMO MODE badge, live UTC clock
│   │   ├── dashboard/
│   │   │   ├── KpiCards.tsx     # 4 KPI cards with SVG sparklines
│   │   ├── RoutePlannerPanel.tsx     # OSRM alternatives and congestion estimates
│   │   ├── TrafficReportDialog.tsx   # GPS-based community report form
│   │   ├── TrafficReportsPanel.tsx   # Active incident feed
│   │   │   ├── TrafficMap.tsx   # Central map container with layer selector
│   │   │   ├── VehicleDetectionPanel.tsx # Camera preview, counts & bounding boxes
│   │   │   ├── SignalControlPanel.tsx    # Phasing table & Apply to Simulation
│   │   │   └── PerformancePanel.tsx      # Recharts comparative line graph
│   │   ├── map/
│   │   │   ├── SchematicMapView.tsx      # Exact SVG digital twin schematic
│   │   │   └── MapLibreView.tsx          # Real MapLibre GL JS OpenFreeMap
│   │   └── ui/
│   │       └── Sparkline.tsx    # Reusable SVG sparkline curve
│   ├── pages/
│   │   ├── Overview.tsx         # Exact recreation of the reference screenshot
│   │   ├── LiveTrafficMap.tsx   # Fullscreen spatial map & node inspection
│   │   ├── IntersectionControl.tsx # Queue sliders & manual override matrix
│   │   ├── VehicleDetection.tsx # Large CV viewer, confidence filter & upload
│   │   ├── PerformanceAnalytics.tsx # Deep-dive Recharts & CSV export
│   │   ├── SimulationLab.tsx    # Scenario runner & clock speed controls
│   │   └── Settings.tsx         # Safety bounds (min/max green) & heuristics
│   ├── App.tsx                  # Root layout & view router
│   ├── main.tsx                 # React entrypoint
│   └── index.css                # Global Tailwind styles & MapLibre overrides
```

---

## 🕹 Features & Interactive Views

1. **Overview (Reference Screenshot)**:
   - 4 KPI cards (`Vehicles in network: 1,284`, `Network congestion: 42%`, `Average wait time: 34 s`, `Adaptive signals online: 12 / 12`).
   - Central map showing `J04 · Central & 5th` floating popup (`Heavy · 24 vehicles in queue`, `Green extension +12 s`).
   - AI Vehicle Detection card with live confidence meter (`96.4%`), car (`18`), bike (`4`), and bus (`2`) counts.
   - Signal Control panel with comparison table (`Fixed: 38s`, `AI: 42s`, `Change: +12s`), and `Apply to simulation` button.
   - Performance impact panel with `-38% Average wait`, `+24% Throughput`, `-27% Est. CO2 emissions`, and Recharts line chart.

2. **Live Traffic Map**:
   - Fullscreen interactive MapLibre map centered on Delhi (77.1025° E, 28.7041° N).
   - Clickable color-coded nodes (Green = Clear, Amber = Moderate, Red = Heavy).
   - Side inspection drawer with approach queue breakdowns and signal states.
   - Community incident feed. Report congestion, accidents, roadwork, hazards, or closures using device GPS; reports are matched to the nearest supported intersection and shown on the map.
   - Route planning between Delhi landmarks. OSRM provides road routes and typical ETAs; CityFlow scores alternatives using simulated congestion and unverified community reports.

3. **Intersection Control**:
   - Real-time management matrix of all 12 intersections.
   - Toggle individual or all controllers between **Adaptive AI** and **Fixed Timing**.
   - Phasing timing table with live adjustment telemetry.

4. **AI Vehicle Detection**:
   - Camera feed switcher across edge nodes (CAM 01 to CAM 12).
   - Live bounding box overlay rendering on simulated road perspectives.
   - Video upload capability to test custom video files.
   - Confidence threshold slider and multi-class distribution.

5. **Performance Analytics**:
   - Multi-metric Recharts graphs: Average Wait Time, Corridor Throughput, and CO2 emissions reduction.
   - One-click CSV report export.

6. **Simulation Lab**:
   - Scenario selection: `Downtown grid · PM peak (CF-024)`, `Inbound commute · AM peak (CF-012)`, `Monsoon downpour · Wet asphalt (CF-088)`, `Lane obstruction · Central Ave (CF-099)`, and `Civic stadium egress (CF-055)`.
   - Speed controls: `0.5x`, `1x`, `2x`, `5x` clock acceleration.
   - Pause, resume, step, and reset engine.

7. **Settings**:
   - Configure safety constraints: Minimum Green (5s-20s), Maximum Green (30s-90s), Clearance Interval (4s-8s).
   - AI controller heuristics: Conservative, Balanced, Aggressive.

---

## 🛠 Setup & Run Instructions

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (v9 or higher)
- Python 3.11 (or compatible) for the Flask backend

### Frontend
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

In development, Vite proxies API requests to the Flask backend on port 5000, including when the frontend is opened through a forwarded/tunneled URL. No API URL setting is needed. If Flask is not running, the original TypeScript demo engine remains the fallback.
The header shows **PYTHON API** when the Flask backend is connected and **LOCAL SIMULATION** when the built-in browser engine is active. Community reports require the backend; they are stored in SQLite and expire after four hours.
Users can create accounts from **Sign in / Sign up** after verifying their mobile number by SMS. Configure Twilio Verify in the backend environment before signup; see [backend/README.md](./backend/README.md). FluxGRID does not collect Aadhaar information. Accident reports appear as pending until an administrator approves or rejects them. To bootstrap the first admin, set `CITYFLOW_ADMIN_EMAIL` and `CITYFLOW_ADMIN_PASSWORD` in the backend terminal before starting Flask; the password must contain at least 12 characters and is stored as a hash.
Route planning also requires the backend and an internet connection to the configured OSRM service. OpenStreetMap routing provides geometry and typical journey times; CityFlow's congestion score is only a simulation/community-report estimate, not live traffic.

### Backend (Windows)
Full API documentation: [backend/README.md](backend/README.md)

```bat
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

```bat
cd backend
.venv\Scripts\activate
pytest
```

### Production Build
```bash
npm run build
npm run preview
```

---

## ⚖️ Disclaimer
*This project is a demonstration and educational prototype developed by Team EchoBYTE for the Smart City & Mobility Hackathon. All traffic measurements, camera feeds, and detection statistics are illustrative simulation data.*
