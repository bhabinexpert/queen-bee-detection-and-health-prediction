# ml/ — trained model weights

Loaded automatically by `../backend/app.py` (it resolves `ml/` relative to
the repo root — no imports to fix here).

| File | Model | Input |
| ---- | ----- | ----- |
| `audio_weights.pth` | ResNet-18 queen detector (2 logits, `backbone.` prefix stripped on load) | 1-channel log-mel spectrogram, 128 × 512 |
| `vision_model.keras` | 6-class **hive-frame** health CNN (current) | 100 × 100 RGB image |
| `vision_model_bee_legacy.h5` | 6-class **bee close-up** disease CNN (legacy `vision_model.h5`, kept for comparison) | 100 × 100 RGB image |

Vision classes (same order for both models): `Healthy`, `Few Varroa, Hive Beetles`,
`Varroa, Small Hive Beetles`, `Ant Problems`, `Robbing Bugs`, `Missing Queen`.

Do not rename these files — the backend looks them up by name in this folder
(falling back to `backend/` for portable deployments). The stray root-level
`vision_model.h5` duplicate has been consolidated into
`ml/vision_model_bee_legacy.h5` — keep models only under `ml/`.
