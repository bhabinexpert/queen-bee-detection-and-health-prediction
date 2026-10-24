"""
🐝 Bee Monitor AI — FastAPI backend (UnifiedBeehiveModel)
=========================================================

Smart Beehive Multi-Modal Health Monitor API.

Trained artifacts (under ../ml relative to this file):
    ml/audio_weights.pth          — ResNet-18 queen detector (1-ch mel-spectrogram)
    ml/vision_model_bee_legacy.h5 — 6-class bee close-up disease CNN (PRIMARY: uploaded photos are bee close-ups)
    ml/vision_model.keras         — 6-class hive-frame health CNN (100x100 RGB, reference only)

Install dependencies (run once from the backend folder):
    pip install -r requirements.txt

Run the server (from the backend folder):
    uvicorn app:app --reload --port 8000
    # or simply:  python app.py

The React dashboard talks to:
    POST http://localhost:8000/predict        # multipart form: audio_file and/or image_file
    GET  http://localhost:8000/health         # model status
    GET  http://localhost:8000/openapi.json   # auto-generated schema
"""
from __future__ import annotations

import io
import os

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Project root = parent of backend/  →  <root>/ml holds the trained weights.
ROOT_DIR = os.path.dirname(BASE_DIR)
ML_DIR = os.path.join(ROOT_DIR, "ml")

app = FastAPI(title="Bee Monitor AI", version="2.0.0")

# CORS — allow the React dashboard (localhost:5173) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

HEALTH_CLASSES = [
    "Healthy",
    "Few Varroa, Hive Beetles",
    "Varroa, Small Hive Beetles",
    "Ant Problems",
    "Robbing Bugs",
    "Missing Queen",
]

# Severity mapping for the 6 vision classes.
SEVERITY_MAP = {
    "Healthy": "Low / None",
    "Few Varroa, Hive Beetles": "Moderate (Early Infection)",
    "Varroa, Small Hive Beetles": "High (Critical Threat)",
    "Ant Problems": "Medium",
    "Robbing Bugs": "Medium",
    "Missing Queen": "High (Critical Threat)",
}


def _first_existing(*paths: str) -> str | None:
    """Return the first path that exists on disk, else None."""
    for p in paths:
        if p and os.path.exists(p):
            return p
    return None


def _resolve_model(basename_variants: list[str]) -> str | None:
    """Look for a model file in backend/ then in the top-level ml/ folder."""
    candidates: list[str] = []
    for base in (BASE_DIR, ML_DIR):
        for name in basename_variants:
            candidates.append(os.path.join(base, name))
    return _first_existing(*candidates)


AUDIO_MODEL_PATH = _resolve_model(["audio_weights.pth", "audio_model.pth"])
# Hive-frame model (reference) + bee close-up model (primary for uploaded photos).
VISION_MODEL_PATH = _resolve_model(["vision_model.keras", "vision_model.h5"])
VISION_BEE_LEGACY_PATH = _resolve_model(
    ["vision_model_bee_legacy.h5", "vision_model.h5", "vision_modal.h5"]
)

# ---------------------------------------------------------------------------
# 1. Optional dependencies
# ---------------------------------------------------------------------------
try:
    import librosa
    import torch
    import torch.nn as nn

    _AUDIO_DEPS = True
except Exception as exc:  # noqa: BLE001
    librosa = torch = nn = None
    _AUDIO_DEPS = False
    print(f"[audio] optional deps unavailable ({exc!r}) — run: pip install librosa soundfile")

try:
    import tensorflow as tf
    from PIL import Image

    _VISION_DEPS = True
except Exception as exc:  # noqa: BLE001
    tf = Image = None
    _VISION_DEPS = False
    print(f"[vision] optional deps unavailable ({exc!r}) — run: pip install tensorflow pillow")


# ---------------------------------------------------------------------------
# 2. Audio model (PyTorch) — ResNet-18 on 1-channel mel-spectrograms
# ---------------------------------------------------------------------------
def _build_audio_model():
    """Build ResNet-18 with 1-ch input + 2-logit head (matches audio_weights.pth)."""
    if not _AUDIO_DEPS:
        return None
    try:
        from torchvision import models as tv_models

        model = tv_models.resnet18(weights=None)
        model.conv1 = nn.Conv2d(1, 64, kernel_size=7, stride=2, padding=3, bias=False)
        model.fc = nn.Sequential(nn.Dropout(0.3), nn.Linear(512, 2))
        return model
    except Exception as exc:  # noqa: BLE001
        print(f"[audio] could not build ResNet-18 ({exc!r}) — using heuristic")
        return None


audio_model = _build_audio_model()

if audio_model is not None and AUDIO_MODEL_PATH and os.path.exists(AUDIO_MODEL_PATH):
    try:
        state = torch.load(AUDIO_MODEL_PATH, map_location="cpu")
        if isinstance(state, dict) and any(k.startswith("backbone.") for k in state.keys()):
            state = {k.replace("backbone.", "", 1): v for k, v in state.items()}
        audio_model.load_state_dict(state, strict=True)
        audio_model.eval()
        print(f"[audio] loaded {os.path.basename(AUDIO_MODEL_PATH)} (ResNet-18)")
    except Exception as exc:  # noqa: BLE001
        audio_model = None
        print(f"[audio] could not load ({exc!r}) — using heuristic")
elif AUDIO_MODEL_PATH is None:
    print("[audio] no audio_weights.pth found under backend/ or ml/ — using heuristic")
# ---------------------------------------------------------------------------
# 3. Vision models (Keras) — bee close-up (PRIMARY) + hive-frame (reference)
# ---------------------------------------------------------------------------
# Uploaded photos are close-ups of bees — there is no hive-frame photo — so
# the bee close-up model owns the health/disease verdict. The hive-frame model
# is still scored (same 100x100 RGB input, same 6-class order, different
# weights) and returned as a reference readout only.
vision_model = vision_bee_legacy_model = None
vision_model_name = vision_bee_legacy_name = None
VISION_SIZE = (100, 100)

if _VISION_DEPS and VISION_MODEL_PATH and os.path.exists(VISION_MODEL_PATH):
    try:
        vision_model = tf.keras.models.load_model(VISION_MODEL_PATH, compile=False)
        vision_model_name = os.path.basename(VISION_MODEL_PATH)
        in_shape = tuple(int(d) for d in vision_model.inputs[0].shape[1:])
        VISION_SIZE = in_shape[:2]
        print(f"[vision] loaded {vision_model_name} (input {in_shape})")
    except Exception as exc:  # noqa: BLE001
        vision_model = None
        print(f"[vision] could not load {os.path.basename(VISION_MODEL_PATH)} ({exc!r})")

if _VISION_DEPS and VISION_BEE_LEGACY_PATH and os.path.exists(VISION_BEE_LEGACY_PATH):
    try:
        same_file = VISION_MODEL_PATH and (
            os.path.abspath(VISION_BEE_LEGACY_PATH) == os.path.abspath(VISION_MODEL_PATH)
        )
        if not same_file:
            vision_bee_legacy_model = tf.keras.models.load_model(
                VISION_BEE_LEGACY_PATH, compile=False
            )
            vision_bee_legacy_name = os.path.basename(VISION_BEE_LEGACY_PATH)
            print(f"[vision-bee] loaded legacy {vision_bee_legacy_name} for comparison")
    except Exception as exc:  # noqa: BLE001
        vision_bee_legacy_model = None
        print(f"[vision-bee] could not load {os.path.basename(VISION_BEE_LEGACY_PATH)} ({exc!r})")


# ---------------------------------------------------------------------------
# 4. Inference helpers
# ---------------------------------------------------------------------------
def predict_queen(spec_db):
    """Queen present? -> (bool, confidence 0..1).

    ``spec_db`` is the standardized log-mel spectrogram (128 x 512).
    """
    if audio_model is not None and _AUDIO_DEPS:
        tensor = torch.from_numpy(spec_db.astype(np.float32)[None, None])
        with torch.no_grad():
            probs = torch.softmax(audio_model(tensor), dim=1)[0].cpu().numpy()
        idx = int(np.argmax(probs))
        conf = float(np.clip(probs[idx], 0.0, 1.0))
        return idx == 1, round(conf, 4)

    # ---- heuristic fallback (no trained audio model available) ----
    # Queen-right hives tend to have a steady, low-frequency-rich hum.
    low = float(spec_db[:40].mean())
    high = float(spec_db[80:].mean())
    contrast = (low - high) / (float(spec_db.std()) + 1e-6)
    conf = 0.5 + 0.45 * float(np.tanh(np.clip(contrast, -1.0, 1.0)))
    present = conf >= 0.5
    return present, round(conf if present else 1.0 - conf, 4)


def predict_health(img_bytes):
    """Condition label + confidence from the current hive-frame model."""
    if vision_model is not None and _VISION_DEPS:
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB").resize(VISION_SIZE)
        arr = np.expand_dims(np.array(img) / 255.0, axis=0).astype(np.float32)
        preds = vision_model.predict(arr, verbose=0)[0]
        idx = int(np.argmax(preds))
        probs = [round(float(np.clip(p, 0.0, 1.0)), 4) for p in preds]
        return HEALTH_CLASSES[idx], round(float(np.clip(preds[idx], 0.0, 1.0)), 4), probs

    # ---- fallback (no vision_model.keras / no tensorflow) ----
    return "Healthy", 0.70, [0.7, 0.06, 0.06, 0.06, 0.06, 0.06]


def vision_compare(img_bytes) -> dict:
    """Score the same photo with BOTH vision models (one preprocessed batch).

    Same 100x100 RGB input + same 6-class order — only the weights differ, so
    a bee close-up surfaces its disease label (legacy model) instead of being
    forced through the hive-frame verdict.
    """
    out: dict = {"models": [], "agreement": None}
    if not _VISION_DEPS:
        return out
    try:
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB").resize(VISION_SIZE)
    except Exception:
        return out
    arr = np.expand_dims(np.array(img) / 255.0, axis=0).astype(np.float32)
    for role, model, path, tag in (
        ("hive_frame", vision_model, VISION_MODEL_PATH, "current hive-frame"),
        ("bee_closeup", vision_bee_legacy_model, VISION_BEE_LEGACY_PATH, "legacy bee close-up"),
    ):
        if model is None:
            continue
        preds = model.predict(arr, verbose=0)[0]
        idx = int(np.argmax(preds))
        probs = [round(float(np.clip(p, 0.0, 1.0)), 4) for p in preds]
        label = HEALTH_CLASSES[idx]
        out["models"].append(
            {
                "role": role,
                "model_tag": tag,
                "model_file": os.path.basename(path) if path else None,
                "detected_issue": label,
                "raw_model_label": label,
                "severity_level": SEVERITY_MAP.get(label, "Medium"),
                "confidence": round(float(np.clip(preds[idx], 0.0, 1.0)), 4),
                "all_probabilities": dict(zip(HEALTH_CLASSES, probs)),
            }
        )
    if len(out["models"]) == 2:
        out["agreement"] = out["models"][0]["detected_issue"] == out["models"][1]["detected_issue"]
    return out


def estimate_agitation_hz(y, sr) -> float:
    """Estimate hive agitation frequency (Hz) from raw audio (spectral centroid)."""
    try:
        if y is None or sr is None or len(y) == 0:
            return 220.0
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        hz = float(np.mean(centroid))
        if not np.isfinite(hz):
            return 220.0
        # Wide 50-5000 Hz band: queenless roar / agitation can read well
        # above 1000 Hz, so don't clip real measurements away.
        return round(float(np.clip(hz, 50.0, 5000.0)), 1)
    except Exception:  # noqa: BLE001
        return 220.0


def swarming_risk_for(agitation_hz: float, queen_present: bool | None) -> str:
    """Swarming risk level — simple frequency logic.

    Low < 300 Hz, Moderate 300-1500 Hz, High >= 1500 Hz.
    Queen presence is shown in its own card; it does not override
    the frequency band here so the card always matches the Hz reading.
    """
    if agitation_hz >= 1500:
        return "High (Impending Swarm Sound Pattern)"
    if agitation_hz >= 300:
        return "Moderate"
    return "Low"


def stability_score_for(queen_present, queen_conf, health_status, health_conf) -> float:
    """Colony stability score 0-100 — simple additive penalties.

    Queen absent: -45. Health: Healthy 0, Few Varroa 15,
    Varroa+Beetles 35, Ants/Robbing 20, Queenless signs 35.
    E.g. absent + Varroa/Beetles = 100-45-35 = 20 (critical).
    Confidence is shown in its own card, not mixed into the score,
    so the gauge always matches the two verdicts above.
    """
    score = 100.0
    if queen_present is not None and not queen_present:
        score -= 45.0
    if health_status is not None:
        penalty = {
            "Healthy": 0.0,
            "Few Varroa, Hive Beetles": 15.0,
            "Varroa, Small Hive Beetles": 35.0,
            "Ant Problems": 20.0,
            "Robbing Bugs": 20.0,
            "Missing Queen": 35.0,
            "Queenless Signs in Photo": 35.0,
        }.get(health_status, 20.0)
        score -= penalty
    return round(float(np.clip(score, 0.0, 100.0)), 1)


def viability_for(score: float) -> str:
    """30-day viability bucket from the stability score."""
    if score >= 75:
        return "90%+ High Survival Probability"
    if score >= 50:
        return "60%-75% Moderate Risk"
    return "<40% High Mortality Risk"


def recommended_action_for(queen_present, health_status, swarming_risk, stability) -> str:
    """Clear beekeeping instructions for the current diagnosis."""
    actions: list[str] = []
    if queen_present is False:
        actions.append(
            "Queenless roar detected in the hive sound — swarm queen-acceptance is "
            "0% because there is no queen present to accept. Inspect frames for "
            "eggs, larvae and queen cells within 24-48h and introduce a mated "
            "queen or queen cell if no brood is found."
        )
    if health_status and health_status != "Healthy":
        if "Varroa" in health_status:
            actions.append(
                f"{health_status} detected — perform an alcohol-wash mite count, treat above "
                "threshold (oxalic/formic per local guidance), and re-check in 2 weeks."
            )
        elif "Beetle" in health_status:
            actions.append(
                "Small hive beetles detected — keep the colony strong, reduce excess space, "
                "and install beetle traps with regular monitoring."
            )
        elif health_status == "Ant Problems":
            actions.append(
                "Ant activity detected — fit hive-stand legs with oil moats/barriers, "
                "clear vegetation, and check entrances and feeders."
            )
        elif health_status == "Robbing Bugs":
            actions.append(
                "Robbing behaviour detected — narrow the entrance, avoid open feeding, "
                "and inspect at dusk to reduce robbing pressure."
            )
        elif health_status == "Missing Queen":
            actions.append(
                "Bee photo shows queenless signs (spotty brood / no eggs visible) — this is a "
                "visual clue only; queen presence itself is decided by the hive-sound "
                "analysis. Confirm with a frame inspection for eggs/brood and check the "
                "queen-presence card before requeening."
            )
        else:
            actions.append(f"Act on the detected condition: {health_status}.")
    if "High" in (swarming_risk or ""):
        actions.append(
            "High swarming risk — check for swarm cells, ensure laying space, "
            "and consider a split or swarm-prevention manipulation."
        )
    if not actions:
        if stability >= 75:
            return ("Colony operating normally — no intervention needed. "
                    "Continue routine inspections every 7-10 days.")
        return "Inspect the hive at the next opportunity and confirm stores, brood and queen status."
    return " ".join(actions)
# ---------------------------------------------------------------------------
# 5. Routes
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": {
            "audio": audio_model is not None,
            "vision": vision_model is not None,
            "vision_bee_legacy": vision_bee_legacy_model is not None,
        },
        "model_files": {
            "audio": os.path.basename(AUDIO_MODEL_PATH) if AUDIO_MODEL_PATH else None,
            "vision": os.path.basename(VISION_MODEL_PATH) if VISION_MODEL_PATH else None,
            "vision_bee_legacy": os.path.basename(VISION_BEE_LEGACY_PATH)
            if vision_bee_legacy_model is not None
            else None,
        },
        "docs": "/docs",
    }


@app.post("/predict")
async def predict(
    audio_file: UploadFile | None = File(default=None),
    image_file: UploadFile | None = File(default=None),
):
    """Diagnose from whichever inputs are provided: audio, image, or both.

    Returns the full UnifiedBeehiveModel JSON plus legacy flat keys.
    """
    if audio_file is None and image_file is None:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one input: audio_file (wav/mp3) and/or image_file (png/jpg).",
        )

    response: dict = {"inputs": []}
    queen_present = None
    queen_conf = 0.0
    agitation_hz = None
    health_status = None
    health_conf = 0.0

    # -------- audio branch --------
    if audio_file is not None:
        audio_bytes = await audio_file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="audio_file is empty")
        if not _AUDIO_DEPS:
            raise HTTPException(status_code=503, detail="Audio deps missing — run: pip install torch torchvision librosa soundfile")

        y, sr = librosa.load(io.BytesIO(audio_bytes), sr=None)
        agitation_hz = estimate_agitation_hz(y, sr)
        mel = librosa.feature.melspectrogram(y=y, sr=sr)
        spec = librosa.power_to_db(mel, ref=np.max)
        spec = (spec - np.mean(spec)) / (np.std(spec) + 1e-6)

        target_len = 512
        if spec.shape[1] > target_len:
            spec = spec[:, :target_len]
        else:
            spec = np.pad(spec, ((0, 0), (0, target_len - spec.shape[1])), mode="constant")

        queen_present, queen_conf = predict_queen(spec)
        # Rule: no queen detected => 0% acceptance chance. The colony cannot
        # accept a queen it does not have; introduction is a separate action.
        if queen_present:
            acceptance = round(float(np.clip(queen_conf * 100.0, 0.0, 100.0)), 1)
            acceptance_reason = (
                f"Queen acoustic signature detected at {agitation_hz:.1f} Hz "
                f"(model confidence {queen_conf:.0%}), so the colony is "
                f"queen-right and acceptance is high."
            )
        else:
            acceptance = 0.0
            acceptance_reason = (
                f"No queen acoustic signature found — agitation at {agitation_hz:.1f} Hz "
                "matches a queenless roar pattern. With no queen present there is "
                "no chance of queen acceptance (0%); inspect and introduce a "
                "mated queen or queen cell."
            )
        response["queen_analysis"] = {
            "presence": "Present" if queen_present else "Absent",
            "status": "Laying Queen Active (Stable Colony)" if queen_present else "Queenless Roar Detected (High Agitation)",
            "acceptance_rate_pct": acceptance,
            "acceptance_reason": acceptance_reason,
            "confidence": round(float(queen_conf), 4),
            # Provenance: this verdict comes ONLY from the sound-frequency model.
            "source": "audio",
            "source_label": "Hive sound frequency analysis",
        }
        response["queen_status"] = "Present" if queen_present else "Absent"
        response["queen_confidence"] = round(float(queen_conf), 4)
        response["inputs"].append("audio")

    # -------- vision branch --------
    if image_file is not None:
        img_bytes = await image_file.read()
        if not img_bytes:
            raise HTTPException(status_code=400, detail="image_file is empty")
        if not _VISION_DEPS:
            raise HTTPException(status_code=503, detail="Vision deps missing — run: pip install tensorflow pillow")

        # Score the SAME photo with BOTH vision models (one shared preprocessed
        # batch). Uploaded photos are bee close-ups: there is no hive-frame
        # photo, so the bee close-up model is the PRIMARY health/disease read
        # and the hive-frame read is kept only as a reference.
        vision_comparison = vision_compare(img_bytes)

        def _readout(model_entry, source_label, fallback_label, fallback_conf):
            """Shape one model's read like the health_analysis contract."""
            if model_entry is None:
                return {
                    "detected_issue": fallback_label,
                    "raw_model_label": fallback_label,
                    "severity_level": SEVERITY_MAP.get(fallback_label, "Medium"),
                    "confidence": round(float(fallback_conf), 4),
                    "source": "image",
                    "source_label": source_label,
                    "available": False,
                }
            label = model_entry["raw_model_label"]
            # "Missing Queen" describes queenless SIGNS in the photo (spotty
            # brood / no eggs) — queen presence itself is the audio model's call.
            visual = "Queenless Signs in Photo" if label == "Missing Queen" else label
            return {
                "detected_issue": visual,
                "raw_model_label": label,
                "severity_level": model_entry["severity_level"],
                "confidence": round(float(model_entry["confidence"]), 4),
                "model_file": model_entry.get("model_file"),
                "model_tag": model_entry.get("model_tag"),
                "source": "image",
                "source_label": source_label,
                "available": True,
            }

        hive_read = next(
            (m for m in vision_comparison["models"] if m["role"] == "hive_frame"), None
        )
        bee_read = next(
            (m for m in vision_comparison["models"] if m["role"] == "bee_closeup"), None
        )

        # NOTE: the "Missing Queen" vision class describes queenless SIGNS in
        # the photo (spotty brood / no eggs) — the authoritative queen
        # presence verdict stays with the audio model (queen_analysis).
        # PRIMARY read: the bee close-up disease model. Uploaded photos are
        # close-ups of bees (there is no hive-frame photo), so this model owns
        # the health/disease verdict; the hive-frame read stays as reference.
        primary = bee_read if bee_read is not None else hive_read
        if primary is not None:
            health_status = primary["raw_model_label"]
            health_conf = primary["confidence"]
            primary_probs = primary["all_probabilities"]
        else:
            # Neither weights file loaded - legacy single-model fallback.
            try:
                health_status, health_conf, health_probs = predict_health(img_bytes)
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(
                    status_code=400, detail=f"Could not read image_file: {exc}"
                ) from exc
            primary_probs = dict(zip(HEALTH_CLASSES, health_probs))

        health_analysis = _readout(
            primary,
            "Bee photo visual inspection (bee disease model)"
            if bee_read is not None
            else "Hive frame photo visual inspection",
            health_status,
            health_conf,
        )
        health_analysis["all_probabilities"] = primary_probs

        response["health_analysis"] = health_analysis
        # Hive-frame read kept for API reference only (the UI shows the bee read).
        if hive_read is not None:
            hive_frame_read = _readout(
                hive_read,
                "Hive frame photo visual inspection (reference only)",
                hive_read["raw_model_label"],
                hive_read["confidence"],
            )
            hive_frame_read["all_probabilities"] = hive_read["all_probabilities"]
            response["health_analysis_hive_frame"] = hive_frame_read
        response["vision_comparison"] = vision_comparison
        if hive_read and bee_read:
            response["vision_comparison"]["agreement_note"] = (
                "Both models agree on this label."
                if vision_comparison["agreement"]
                else (
                    f"Models disagree — hive-frame says '{hive_read['raw_model_label']}' "
                    f"({hive_read['confidence']:.1%}), bee close-up says "
                    f"'{bee_read['raw_model_label']}' ({bee_read['confidence']:.1%}). "
                    "For a close-up photo of bees, prefer the bee model's disease label."
                )
            )
        response["health_status"] = health_status
        response["health_confidence"] = round(float(health_conf), 4)
        response["inputs"].append("image")

    # -------- behaviour + forecasting (always returned) --------
    if agitation_hz is None:
        agitation_hz = 220.0 if health_status in (None, "Healthy") else 310.0
    risk = swarming_risk_for(float(agitation_hz), queen_present)
    stability = stability_score_for(queen_present, queen_conf, health_status, health_conf)
    viability = viability_for(float(stability))
    action = recommended_action_for(queen_present, health_status, risk, float(stability))

    # Cross-model note so the two cards never read as contradicting each
    # other: audio owns queen PRESENCE, vision owns visual HEALTH signs.
    if queen_present is not None and health_status is not None:
        if queen_present and health_status == "Healthy":
            signal_consistency = "Audio and bee photo agree — queen-right sound and a healthy-looking photo."
        elif not queen_present and health_status == "Missing Queen":
            signal_consistency = "Audio and bee photo agree — queenless roar plus queenless signs in the photo."
        elif not queen_present:
            signal_consistency = "Queen verdict comes from the hive sound (absent); the bee photo only describes visual health, not queen presence."
        else:
            signal_consistency = "Queen verdict comes from the hive sound (present); the bee photo only describes visual health, not queen presence."
    elif queen_present is not None:
        signal_consistency = "Queen verdict from hive sound only — upload a bee photo for the visual health check."
    elif health_status is not None:
        signal_consistency = "Health verdict from the bee photo only — upload a recording for the queen sound check."
    else:
        signal_consistency = ""

    response["hive_behavior_metrics"] = {
        "agitation_frequency_hz": round(float(agitation_hz), 1),
        "swarming_risk": risk,
        "colony_stability_score": float(stability),
    }
    response["predictive_forecasting"] = {
        "colony_viability_30d": viability,
        "recommended_action": action,
        "signal_consistency": signal_consistency,
    }

    # -------- overall verdict & legacy recommendation --------
    if queen_present is not None and health_status is not None:
        overall_healthy = queen_present and health_status == "Healthy"
    elif health_status is not None:
        overall_healthy = health_status == "Healthy"
    else:
        overall_healthy = bool(queen_present)

    response["overall_diagnosis"] = "Healthy" if overall_healthy else "Action Required"
    response["recommendation"] = action

    return response


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)