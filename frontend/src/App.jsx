import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CirclePlay, ClipboardCheck, FlaskConical, Loader2, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { checkApiHealth, PREDICT_URL, predictHiveHealth } from "./lib/api.js";
import Header from "./components/Header.jsx";
import UploadBox from "./components/UploadBox.jsx";
import Scorecard from "./components/Scorecard.jsx";
import ReportCard from "./components/ReportCard.jsx";
import ActionAlert from "./components/ActionAlert.jsx";

// Sample preview matching the full UnifiedBeehiveModel JSON contract.
// NOTE: queen presence comes from the AUDIO (hive-sound) model; diseases &
// health come from the bee-photo vision model. Acceptance is locked to
// presence (absent => 0% + reason).
const SAMPLE_RESULT = {
  inputs: ["audio", "image"],
  queen_analysis: {
    presence: "Absent",
    status: "Queenless Roar Detected (High Agitation)",
    acceptance_rate_pct: 0.0,
    acceptance_reason:
      "No queen acoustic signature found — with no queen present there is no chance of queen acceptance (0%).",
    confidence: 1.0,
  },
  health_analysis: {
    detected_issue: "Few Varroa, Hive Beetles",
    raw_model_label: "Few Varroa, Hive Beetles",
    severity_level: "Moderate (Early Infection)",
    confidence: 0.612,
    source: "image",
    source_label: "Bee photo visual inspection (bee disease model)",
    model_tag: "legacy bee close-up",
    available: true,
    all_probabilities: {
      Healthy: 0.041,
      "Few Varroa, Hive Beetles": 0.612,
      "Varroa, Small Hive Beetles": 0.179,
      "Ant Problems": 0.087,
      "Robbing Bugs": 0.046,
      "Missing Queen": 0.035,
    },
  },
  hive_behavior_metrics: {
    agitation_frequency_hz: 1440.2,
    swarming_risk: "Moderate",
    colony_stability_score: 20.0,
  },
  predictive_forecasting: {
    colony_viability_30d: "<40% High Mortality Risk",
    recommended_action: "Immediate Intervention Required: Introduce new queen cage or apply pest treatment.",
    signal_consistency: "Audio and photo agree — queenless sound plus a high-severity pest detection.",
  },
  overall_diagnosis: "Action Required",
  recommendation: "Immediate Intervention Required: Introduce new queen cage or apply pest treatment.",
};

function clamp01(value) {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function clampScore(value) {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

/**
 * Normalise the UnifiedBeehiveModel JSON (new nested schema) while still
 * accepting the legacy flat keys (queen_status/health_status/...) so older
 * backends and the sample preview keep rendering.
 */
function normalizePrediction(raw = {}) {
  const q = raw.queen_analysis || {};
  const h = raw.health_analysis || {};
  const m = raw.hive_behavior_metrics || {};
  const f = raw.predictive_forecasting || {};

  const legacyQueen = raw.queen_status != null ? String(raw.queen_status) : null;
  const legacyHealth = raw.health_status != null ? String(raw.health_status) : null;

  const hasQueen = q.presence != null || legacyQueen != null;
  const hasHealth = h.detected_issue != null || legacyHealth != null;

  const queen_analysis = hasQueen
    ? (() => {
        const presence =
          q.presence || (legacyQueen?.toLowerCase() === "present" ? "Present" : "Absent");
        const isPresent = presence === "Present";
        // Enforce: no queen => 0% acceptance, with the reason surfaced.
        const acceptance_rate_pct = isPresent
          ? Math.max(0, Math.min(100, Number(q.acceptance_rate_pct ?? (legacyQueen?.toLowerCase() === "present" ? 90 : 15)) || 0))
          : 0;
        const acceptance_reason =
          q.acceptance_reason ||
          (isPresent
            ? "Queen acoustic signature detected in the hive recording, so acceptance follows model confidence."
            : "No queen acoustic signature found — with no queen present there is no chance of queen acceptance (0%).");
        return {
          presence,
          status:
            q.status ||
            (isPresent
              ? "Laying Queen Active (Stable Colony)"
              : "Queenless Roar Detected (High Agitation)"),
          acceptance_rate_pct,
          acceptance_reason,
          confidence: clamp01(q.confidence ?? raw.queen_confidence ?? 0),
          source: q.source || "audio",
          source_label: q.source_label || "Hive sound frequency analysis",
        };
      })()
    : undefined;

  const health_analysis = hasHealth
    ? {
        // The vision "Missing Queen" class means queenless SIGNS in the
        // photo — never a queen-presence verdict (audio owns that).
        detected_issue:
          (h.detected_issue || legacyHealth || "Healthy") === "Missing Queen"
            ? "Queenless Signs in Photo"
            : h.detected_issue || legacyHealth || "Healthy",
        raw_model_label: h.raw_model_label || h.detected_issue || legacyHealth || "Healthy",
        severity_level: h.severity_level || "Medium",
        confidence: clamp01(h.confidence ?? raw.health_confidence ?? 0),
        source: h.source || "image",
        source_label: h.source_label || "Bee photo visual inspection (bee disease model)",
        model_file: h.model_file || null,
        model_tag: h.model_tag || null,
        available: h.available !== false,
        // Full class-probability vector from the bee-photo model.
        all_probabilities:
          h.all_probabilities && typeof h.all_probabilities === "object"
            ? h.all_probabilities
            : null,
      }
    : undefined;

  const hive_behavior_metrics = {
    agitation_frequency_hz: Number(m.agitation_frequency_hz ?? 220) || 220,
    swarming_risk: m.swarming_risk || "Low",
    colony_stability_score: clampScore(m.colony_stability_score ?? 0),
  };

  const predictive_forecasting = {
    colony_viability_30d: f.colony_viability_30d || "60%-75% Moderate Risk",
    recommended_action: f.recommended_action || raw.recommendation || "",
    signal_consistency: f.signal_consistency || "",
  };

  return {
    inputs: Array.isArray(raw.inputs)
      ? raw.inputs.map(String)
      : hasQueen && hasHealth
        ? ["audio", "image"]
        : hasQueen
          ? ["audio"]
          : hasHealth
            ? ["image"]
            : [],
    queen_analysis,
    health_analysis,
    hive_behavior_metrics,
    predictive_forecasting,
    overall_diagnosis: raw.overall_diagnosis || "Action Required",
    recommendation: predictive_forecasting.recommended_action,
  };
}
export default function App() {
  const [audioFile, setAudioFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [apiStatus, setApiStatus] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Poll the API every few seconds so the header badge stays accurate.
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      const s = await checkApiHealth();
      if (alive) setApiStatus(s);
    };
    ping();
    const id = setInterval(ping, 6000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const refresh = async () => setApiStatus(await checkApiHealth());

  const hasAnyInput = Boolean(audioFile || imageFile);
  const canAnalyze = hasAnyInput && !loading;

  async function handleAnalyze() {
    if (!hasAnyInput || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const raw = await predictHiveHealth({ audioFile, imageFile });
      setResult(normalizePrediction(raw));
      setApiStatus("connected");
    } catch (err) {
      setApiStatus(await checkApiHealth());
      setError(err instanceof Error ? err.message : "Failed to reach the Hive AI service.");
    } finally {
      setLoading(false);
    }
  }

  const loadSample = () => {
    setLoading(false);
    setError(null);
    setResult(normalizePrediction(SAMPLE_RESULT));
  };

  const clearResults = () => {
    setResult(null);
    setError(null);
  };

  const buttonCls = canAnalyze
    ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-900 hover:brightness-105"
    : "bg-stone-200 text-stone-400";

  const statusLine = !hasAnyInput
    ? "Add a hive recording or a photo to begin. Either input works on its own."
    : !audioFile
      ? "Bee photo attached. Add a recording for the full check, or analyze photo only."
      : !imageFile
        ? "Recording attached. Add a photo for the full check, or analyze audio only."
        : "Both inputs attached. Ready for the full multi-modal analysis.";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-amber-100 via-amber-50 to-orange-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 honeycomb-pattern opacity-60" />
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-12 pt-6 sm:px-6">
        <Header status={apiStatus} onRefresh={refresh} />

        <section className="rounded-2xl border border-amber-200/70 bg-white/85 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Audio + Vision diagnostics
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Single or combined input
            </span>
          </div>
          <h2 className="mt-4 max-w-xl text-2xl font-bold tracking-tight text-stone-800 sm:text-3xl">
            Check your colony health in under a minute
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
            Upload a hive recording, a Bee photo, or both. The audio model listens for the queen
            and the vision model inspects the colony for pests — then you get a clear verdict with
            recommended next steps.
          </p>
          <ol className="mt-5 grid gap-2 text-xs font-medium text-stone-600 sm:grid-cols-3">
            <li className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 text-[11px] font-bold text-white">1</span>
              Add a recording or photo
            </li>
            <li className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 text-[11px] font-bold text-white">2</span>
              Run the analysis
            </li>
            <li className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 text-[11px] font-bold text-white">3</span>
              Follow the action plan
            </li>
          </ol>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <UploadBox
            step={1}
            kind="audio"
            title="Hive audio recording"
            description="WAV or MP3, or record live with your microphone."
            file={audioFile}
            onFile={setAudioFile}
            onClear={() => setAudioFile(null)}
          />
          <UploadBox
            step={2}
            kind="image"
            title="Bee photo"
            description="PNG or JPEG, or capture live with your camera."
            file={imageFile}
            onFile={setImageFile}
            onClear={() => setImageFile(null)}
          />
        </section>

        <section className="rounded-2xl border border-amber-200/70 bg-white/85 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 text-white">
                <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-800">Ready when you are</p>
                <p className="truncate text-xs text-stone-500">{statusLine}</p>
              </div>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:shadow-none ${buttonCls}`}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <CirclePlay className="h-5 w-5" aria-hidden="true" />}
              {loading ? "Analyzing hive health" : "Analyze hive health"}
            </motion.button>
          </div>
        </section>
        {/* ---- Transient states: loading / error ---- */}
        <AnimatePresence>
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div className="shimmer h-44 rounded-2xl border border-amber-200/60" />
                <div className="shimmer h-44 rounded-2xl border border-amber-200/60" />
              </div>
              <div className="shimmer mt-4 h-28 rounded-2xl border border-amber-200/60" />
            </motion.div>
          )}

          {error && !loading && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600">
                  <WifiOff className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-rose-900">Could not reach the Hive AI service</p>
                  <p className="mt-0.5 text-xs text-rose-600">
                    POST <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">{PREDICT_URL}</code> — {error}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadSample}
                  className="rounded-full bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                >
                  Preview with sample data
                </button>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="rounded-full border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}

          {result && !loading && (
            <>
              <motion.section
                key="scorecard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <Scorecard
                  score={result.hive_behavior_metrics?.colony_stability_score}
                  viability={result.predictive_forecasting?.colony_viability_30d}
                  action={result.predictive_forecasting?.recommended_action}
                />
              </motion.section>

              <motion.section
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
                className="rounded-2xl border border-amber-200/70 bg-white/85 p-5 shadow-sm backdrop-blur-sm sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-stone-800">
                      <ClipboardCheck className="h-5 w-5 text-amber-600" aria-hidden="true" />
                      Analysis results
                    </h2>
                    <p className="text-xs text-stone-500">
                      Diagnosed from the uploaded{" "}
                      {result.inputs && result.inputs.length > 1
                        ? "recording and bee photo"
                        : result.inputs?.[0] === "image"
                          ? "bee photo"
                          : "hive recording"}
                      .
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearResults}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-2 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Analyze another sample
                  </button>
                </div>

                <div className="mt-5">
                  <ReportCard result={result} />
                </div>

                {result.predictive_forecasting?.signal_consistency && (
                  <p className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-stone-600">
                    <span className="font-semibold text-stone-700">How to read this report: </span>
                    {result.predictive_forecasting.signal_consistency}
                  </p>
                )}

                <div className="mt-5">
                  <ActionAlert
                    score={result.hive_behavior_metrics?.colony_stability_score}
                    forecast={result.predictive_forecasting}
                    queen={result.queen_analysis}
                    health={result.health_analysis}
                  />
                </div>
              </motion.section>
            </>
          )}
        </AnimatePresence>

        {/* <footer className="rounded-2xl border border-amber-200/70 bg-white/85 px-5 py-4 shadow-sm backdrop-blur-sm">
          <p className="flex flex-wrap items-center justify-center gap-2 text-xs text-stone-500">
            <Hexagon className="h-4 w-4 text-amber-600" aria-hidden="true" />
            Bee Monitor AI · posts to
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-800">
              {PREDICT_URL}
            </code>
            · React, Tailwind CSS, Framer Motion
          </p>
        </footer> */}
      </div>
    </div>
  );
}