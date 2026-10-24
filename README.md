# 🐝 Smart Beehive Monitoring System

AI-driven dashboard for the **UnifiedBeehiveModel** multi-modal pipeline
(acoustic Mel-spectrogram + visual hive-health).

## Layout

```text
try/
├── frontend/   # React + Vite + Tailwind dashboard (see frontend/README.md)
├── backend/    # FastAPI API — POST /predict, GET /health (see backend/app.py)
└── ml/         # trained weights loaded by the backend
    ├── audio_weights.pth   # ResNet-18 queen detector (1-ch mel-spectrogram)
    └── vision_model.keras  # 6-class hive-health CNN (100x100 RGB)
```

## Quickstart

```bash
# 1. Backend (from the backend/ folder)
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000

# 2. Frontend (new terminal, from the frontend/ folder)
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Upload a hive recording (.wav) and/or a hive
photo (.jpg/.png), then press **Analyze Colony**.
