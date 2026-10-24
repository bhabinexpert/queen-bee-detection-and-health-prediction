export const API_BASE = "http://localhost:8000";
export const PREDICT_URL = `${API_BASE}/predict`;

// Request timeout (ms) — surfaces a clear error instead of hanging forever.
export const PREDICT_TIMEOUT_MS = 120000;

/**
 * Race a promise against a timeout. Needed because `fetch` has no
 * cross-browser request timeout of its own.
 */
function withTimeout(promise, ms, label = "Request timed out") {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Ping the FastAPI service by requesting its auto-generated
 * OpenAPI schema document. Returns "connected" | "offline".
 */
export async function checkApiHealth() {
  try {
    const res = await withTimeout(
      fetch(`${API_BASE}/openapi.json`),
      3000,
      "API health check timed out"
    );
    return res.ok ? "connected" : "offline";
  } catch {
    return "offline";
  }
}

/**
 * POST audio and/or image to the prediction endpoint as multipart/form-data.
 * Either file may be omitted — the server diagnoses whichever is provided.
 * Rejects clearly on HTTP errors and on network/response timeouts.
 * @param {File|null} audioFile .wav / .mp3 recording
 * @param {File|null} imageFile .png / .jpg / .jpeg bee photo
 */
export async function predictHiveHealth({ audioFile, imageFile }) {
  const form = new FormData();
  if (audioFile) form.append("audio_file", audioFile);
  if (imageFile) form.append("image_file", imageFile);

  let response;
  try {
    response = await withTimeout(
      fetch(PREDICT_URL, { method: "POST", body: form }),
      PREDICT_TIMEOUT_MS,
      `Analysis timed out after ${Math.round(PREDICT_TIMEOUT_MS / 1000)}s — the models can be slow on first run. Try again.`
    );
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        "Could not reach the Hive AI service. Start the backend (`cd backend` then `uvicorn app:app --port 8000`) and retry."
      );
    }
    throw err;
  }

  if (!response.ok) {
    let detail = `Server responded with status ${response.status}.`;
    try {
      const body = await response.json();
      if (body?.detail) {
        detail = Array.isArray(body.detail)
          ? body.detail.map((d) => d.msg).filter(Boolean).join(" · ")
          : String(body.detail);
      }
    } catch {
      /* keep fallback message */
    }
    throw new Error(detail);
  }

  return response.json();
}