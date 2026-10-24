# 🐝 Bee Monitor AI — Smart Beehive Multi-Modal Health Monitor

A modern, warm, eco-friendly **React + Tailwind CSS** dashboard for the Smart Beehive
Multi-Modal Health Monitor. It uploads a hive audio recording **and** a hive photo,
sends them to the FastAPI backend at `http://localhost:8000/predict` as
`multipart/form-data`, then visualises the audio diagnosis (queen present/absent),
the vision diagnosis (condition), confidence scores and an actionable insight card.

## Tech Stack

| Layer       | Library        |
| ----------- | -------------- |
| UI          | React 19       |
| Styling     | Tailwind CSS 4 (via `@tailwindcss/vite`) |
| Icons       | Lucide (`lucide-react`) |
| Animation   | Framer Motion (`framer-motion`) |
| Build       | Vite 8         |

## Project Structure (repo root)

```text
try/
├── frontend/            # React + Vite + Tailwind dashboard
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── lib/
│       │   ├── api.js   # predict + health-check (120s timeout)
│       │   └── wav.js   # mic-recording WAV encoder
│       └── components/
│           ├── Header.jsx
│           ├── UploadBox.jsx
│           ├── AudioRecorder.jsx
│           ├── CameraCapture.jsx
│           ├── ConfidenceBar.jsx
│           ├── Scorecard.jsx      # colony stability gauge (hero)
│           ├── QueenCard.jsx      # queen + acoustic intelligence
│           ├── HealthCard.jsx     # visual health & pest detection
│           └── ActionAlert.jsx    # actionable recommendations
├── backend/             # FastAPI UnifiedBeehiveModel API
│   ├── app.py           # run with: uvicorn app:app --port 8000
│   ├── requirements.txt
│   └── __init__.py
└── ml/                  # trained weights (loaded by backend/app.py)
    ├── audio_weights.pth   # ResNet-18 queen detector
    └── vision_model.keras  # 6-class hive-health CNN
```

## Getting Started

### 1. Run the backend (FastAPI)

From the `backend/` folder (`app.py` — it loads the models from `../ml/`):

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
# or: python app.py
```

### 2. Run the dashboard

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The header badge polls
`http://localhost:8000/openapi.json` every 6 s to show **API Connected / Offline**.

### 3. Build for production

```bash
npm run build     # outputs to frontend/dist
npm run preview   # serve the production build
```

## API Contract

**`POST http://localhost:8000/predict`** — `multipart/form-data`
Provide **at least one** of the two fields (either one is enough; both is best):

| Field        | Type | Notes                          |
| ------------ | ---- | ------------------------------ |
| `audio_file` | file | `.wav` / `.mp3` recording (optional) |
| `image_file` | file | `.png` / `.jpg` / `.jpeg` photo (optional) |

**Response** — the full UnifiedBeehiveModel JSON (plus legacy flat keys and
an `inputs` hint):

```json
{
  "inputs": ["audio", "image"],
  "queen_analysis": {
    "presence": "Present",
    "status": "Laying Queen Active (Stable Colony)",
    "acceptance_rate_pct": 95.4,
    "confidence": 0.98
  },
  "health_analysis": {
    "detected_issue": "Healthy",
    "severity_level": "Low / None",
    "confidence": 0.942
  },
  "hive_behavior_metrics": {
    "agitation_frequency_hz": 284.5,
    "swarming_risk": "Low",
    "colony_stability_score": 92.5
  },
  "predictive_forecasting": {
    "colony_viability_30d": "90%+ High Survival Probability",
    "recommended_action": "Colony operating normally — no intervention needed. Continue routine inspections every 7-10 days."
  },
  "overall_diagnosis": "Healthy",
  "recommendation": "Colony operating normally — no intervention needed. Continue routine inspections every 7-10 days."
}
```

- `audio_file` only → response contains `queen_status`, `queen_confidence`
- `image_file` only → response contains `health_status`, `health_confidence`
- no files at all → `400`

The dashboard handles all three cases: the Analyze button enables with a
single input, only the relevant diagnosis card(s) are shown, and the actionable
insight banner is computed from whatever modality was analysed.

The dashboard handles the offline case with a friendly error banner and a
**“Preview with sample data”** button so you can explore the UI without the
backend running.