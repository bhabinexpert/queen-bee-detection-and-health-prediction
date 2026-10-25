# BeeMonitor AI — Diagnostic Report System

## Overview

**BeeMonitor AI** is an end-to-end hive-diagnostic application that combines audio (hive-sound) analysis and visual (bee close-up photo) analysis to produce a unified diagnostic report for beekeepers. Uploaded photos are treated as bee close-ups (single-bee/vision model readout — no hive-frame comparison), while hive audio is analyzed by a sound model to predict queen presence, behavior, agitation, swarming risk, and stability.

The system restructures the diagnostic report so that:

- Left column = everything the hive-sound model predicts (queen analysis, hive behavior metrics, stability score, agitation frequency, swarm risk).
- Right column = the bee-photo model's diseases & health readout, shown in full detail (severity, confidence, source/model, and the complete 6-class probability vector).

## Core Idea

A beekeeper uploads a bee photo (and optionally an audio recording). The backend runs two independent AI models:

1. Bee-photo (vision) model — classifies the close-up photo into one of 6 disease/health classes and emits a full probability vector.
2. Hive-sound (audio) model — predicts queen presence, agitation, swarming tendency, and overall colony stability from hive audio.

The frontend then presents these in a two-column diagnostic report: sound-derived insights on the left, photo-derived disease/health details on the right. A 30-day predictive forecast ties both signals together into actionable recommendations.

## Project Structure

```
try/
├── backend/
│   └── app.py                 # FastAPI backend: model loading, /predict, /health, /openapi.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # React entry: state, normalizer, sample preview, /predict consumer
│   │   ├── lib/
│   │   │   └── api.js         # API client: predictHiveHealth(), checkApiHealth() fetch wrappers
│   │   └── components/
│   │       ├── ReportCard.jsx         # Two-column diagnostic report (sound | bee-photo)
│   │       ├── HealthCard.jsx         # Bee-photo diseases & health card (full detail)
│   │       ├── ActionAlert.jsx        # Actionable alerts derived from verdicts
│   │       ├── ConfidenceBar.jsx      # Confidence visualization component
│   │       ├── Scorecard.jsx          # Summary scorecard
│   │       ├── UploadBox.jsx          # Photo + audio file upload UI
│   │       ├── AudioRecorder.jsx      # In-browser hive audio recording
│   │       ├── CameraCapture.jsx      # In-browser bee photo capture
│   │       ├── QueenCard.jsx          # Queen presence card
│   │       └── Header.jsx             # App header
│   │   ├── index.css
│   │   ├── index.html
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── ml/
│   ├── audio_weights.pth         # ResNet-18 hive-sound (queen/behavior) model
│   ├── vision_model_bee_legacy.h5 # 6-class bee close-up disease CNN (PRIMARY for uploaded photos)
│   └── vision_model.keras        # 6-class hive-frame health CNN (reference only)
└── README.md
```


## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (BEEKEEPER)                         │
│  Uploads bee photo (.jpg/.png) + optional hive audio recording  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                     │
│  • App.jsx          – app state, /predict consumer, normalizer  │
│  • api.js           – REST client wrappers                      │
│  • ReportCard.jsx   – two-column report layout                  │
│  • HealthCard.jsx   – bee-photo diseases & health (full detail) │
│  • ActionAlert.jsx  – derived actionable alerts                 │
│  • ConfidenceBar.jsx – confidence visualization                 │
└──────────────────┬──────────────────────────────────────────────┘
                   │  HTTP (fetch / API)
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI, Python)                   │
│  app.py                                      │
│  ├─ GET /health   – model readiness status                       │
│  ├─ POST /predict – runs vision + audio models, merges contract  │
│  └─ GET /openapi.json – auto-generated API schema               │
│                                                                 │
│  Models loaded at startup (from ../ml):                         │
│  ├─ vision_model_bee_legacy.h5   (bee close-up disease model)   │
│  ├─ vision_model.keras           (hive-frame reference model)   │
│  └─ audio_weights.pth            (ResNet-18 hive-sound model)   │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MODEL ARTIFACTS                              │
│  vision_model_bee_legacy.h5  → input (100, 100, 3)              │
│  audio_weights.pth           → ResNet-18 sound classifier       │
└─────────────────────────────────────────────────────────────────┘
```

**Data flow:**

1. Frontend sends the bee photo (and optional audio) to `POST /predict` via `predictHiveHealth()` in `api.js`.
2. Backend `predict()` in `app.py` loads/runs the bee-photo vision model → `health_analysis` (primary verdict), keeps the hive-frame model as `health_analysis_hive_frame` (reference only), runs the hive-sound audio model → `queen_analysis` / `hive_behavior_metrics`, and runs predictive forecasting → `predictive_forecasting`.
3. `App.jsx` normalizes the backend contract into UI-ready state.
4. `ReportCard.jsx` renders the two columns: left = sound predictions; right = bee-photo diseases & health with full 6-class probability vector.
5. `ActionAlert.jsx` derives actionable recommendations from the combined verdicts.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | FastAPI (Python 3) | REST API: `POST /predict`, `GET /health`, `GET /openapi.json` |
| Backend model | PyTorch / torchvision | Loads `audio_weights.pth` (ResNet-18 sound model) |
| Backend vision | TensorFlow / Keras | Loads `.keras` / `.h5` vision models |
| Frontend | React 18 + Vite | Single-page dashboard |
| Styling | Tailwind CSS | Utility-first UI |
| Animation | Framer Motion | Smooth transitions / entrance animations |
| Icons | lucide-react | Consistent iconography |
| AI models | ResNet-18 (sound), Keras CNN (vision) | Multi-modal hive diagnosis |
| HTTP client | native `fetch` (with timeout wrapper) | `api.js` wraps fetch with timeout + error handling |

## AI Models & Contract

**Backend (`backend/app.py` → `predict()`):**

- Loads all model artifacts at startup from `../ml/`.
- `POST /predict` accepts `multipart/form-data` with optional fields `audio_file` and/or `image_file`.
- Returns a merged JSON object with these top-level keys:
  - `inputs` — array of input types received (e.g. `["audio", "image"]`)
  - `queen_analysis` — sound-model verdict on queen presence + acceptance rate
  - `health_analysis` — bee close-up model (primary) diseases & health verdict
  - `health_analysis_hive_frame` — hive-frame model (reference only)
  - `vision_comparison` — agreement note between the two vision models
  - `hive_behavior_metrics` — agitation Hz, swarm risk, stability score
  - `predictive_forecasting` — 30-day colony viability + recommended action
  - `overall_diagnosis` — `Healthy` / `Action Required`
  - `recommendation` — plain-language action

**Frontend contract consumer (`frontend/src/App.jsx` → `normalizePrediction()`):**

- Accepts the nested schema above and legacy flat keys (`queen_status`, `health_status`, etc.) for backward compatibility.
- Produces a flat UI-ready object consumed by `ReportCard`, `HealthCard`, and `ActionAlert`.


## AI Usage Disclosure

AI was used to generate, explain, and refactor code throughout this project. Every file below contains AI-generated output that is consumed programmatically (i.e., the AI-produced logic is part of the running application, not just documentation):

| File | AI-consumed location | What AI generated |
|------|---------------------|-------------------|
| `backend/app.py` | `predict()` | Model-loading logic, vision + audio inference, response-merging, predictive forecasting functions |
| `frontend/src/App.jsx` | `normalizePrediction()`, `SAMPLE_RESULT`, UI layout | Backend-contract normalizer, sample preview data, component wiring |
| `frontend/src/components/ReportCard.jsx` | `ReportCard` component | Two-column report layout, score/severity color logic, probability rendering |
| `frontend/src/components/HealthCard.jsx` | `HealthCard` component | Bee-photo diseases & health card, severity tones, confidence bar integration |
| `frontend/src/components/ActionAlert.jsx` | `ActionAlert` component | Actionable alert derivation from combined verdicts |
| `frontend/src/lib/api.js` | `predictHiveHealth()`, `checkApiHealth()` | HTTP client wrappers with timeout, error parsing, health-check logic |

**How to verify:** Open any of the files above and inspect the referenced functions — the model inference, contract normalisation, alert derivation, and API client logic are all AI-generated code that runs in production as part of the BeeMonitor AI application.

This disclosure satisfies competition requirements for "Build with AI" qualification: AI-assisted code is shipped and executed, not merely suggested.

## Data Flow (Expanded)

```
┌──────────────┐
│   BEEKEEPER   │  uploads bee photo + optional hive audio
└──────┬───────┘
       │  fetch (multipart/form-data)
       ▼
┌──────────────┐  POST /predict  ┌──────────────────┐
│  frontend    │ ───────────────►│   FastAPI app    │
│  (api.js)    │                 │   backend/app.py │
└──────┬───────┘                 └─────────┬────────┘
       │                                    │
       │                                    ▼
       │                         ┌──────────────────┐
       │                         │  load models     │
       │                         │  (at startup)    │
       │                         └─────────┬────────┘
       │                                   │
       │              ┌────────────────────┼────────────────────┐
       │              ▼                    ▼                    ▼
       │        ┌──────────┐        ┌──────────┐        ┌──────────┐
       │        │ audio    │        │ vision   │        │ vision   │
       │        │ model    │        │ model    │        │ model    │
       │        │ (sound)  │        │ (bee     │        │ (hive-   │
       │        │ ResNet-18│        │ close-up │        │ frame)   │
       │        └────┬─────┘        │ primary  │        │ ref only │
       │             │             └────┬──────┘        └────┬─────┘
       │             │                 │                    │
       │             ▼                 ▼                    ▼
       │        ┌──────────┐  ┌──────────────┐   ┌──────────┐
       │        │ queen_   │  │ health_      │   │ health_  │
       │        │ analysis │  │ analysis     │   │ analysis │
       │        │          │  │ _hive_frame  │   │ _hive_frame│
       │        └────┬─────┘  └──────┬───────┘   └────┬─────┘
       │             │              │                 │
       │             └──────────────┴─────────────────┘
       │                         │
       │              ┌──────────▼──────────┐
       │              │  predictive         │
       │              │  forecasting        │
       │              │  (30-day viability) │
       │              └──────────┬──────────┘
       │                         │
       │                         ▼
       │              ┌──────────────────┐
       │              │ merged JSON      │
       │              │ contract         │
       │              └──────────┬────────┘
       │                         │
       │    HTTP JSON response   │
       │ ◄───────────────────────┘
       ▼
┌──────────────┐
│  frontend    │  App.jsx normalizes →
│  (normalize) │    ReportCard / HealthCard / ActionAlert
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   USER SEES   │  two-column report + alerts + forecast
└──────────────┘


## Limitations

- Single photo only: Uploaded photos are treated as bee close-ups; no hive-frame photo comparison is performed in the UI (the hive-frame model result is kept as reference only).
- Backend loads models at startup: First `/predict` call may be slow while models initialise; subsequent calls are faster.
- Frontend hardcodes `http://localhost:8000`: Change `API_BASE` in `frontend/src/lib/api.js` for remote deployment.
- No authentication: The API is open (CORS allows all origins) — suitable for local/demo use, not production without hardening.
- Audio model optional: If `librosa`/`torch` are unavailable, the backend degrades gracefully but queen/behavior insights are missing.

## Future Improvements

- Deploy backend behind HTTPS with auth + rate limiting.
- Support hive-frame photo upload alongside bee close-up for side-by-side comparison.
- Add persistent diagnosis history (database) per apiary/hive.
- Offline-first PWA for field use without network.
- Multi-language support for beekeeper-facing UI text.
- Export diagnosis report as PDF.

## Getting Started

### Prerequisites

- Python 3.9+ with `pip`
- Node.js 18+ with `npm`

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
# The API is now at http://localhost:8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 3. Use

1. Upload a bee photo (`.jpg`/`.png`).
2. Optionally upload a hive audio recording (`.wav`).
3. Click **Analyze Colony**.
4. Review the two-column diagnostic report (sound | photo), alerts, and 30-day forecast.

## Competition Checklist

- [x] Public GitHub repository
- [x] Documentation (`README.md` with all sections)
- [x] Working demo (backend `/predict` endpoint + React frontend)
- [x] Demo video support (documented problem → solution → workflow → value)
- [x] "Build with AI" qualification (AI-generated code consumed in `app.py`, `App.jsx`, `ReportCard.jsx`, `HealthCard.jsx`, `ActionAlert.jsx`, `api.js`)
- [x] AI Usage Disclosure (Section above with exact file/function mapping)
