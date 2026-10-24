import { motion } from "framer-motion";
import { Activity, Crown, Leaf, TrendingUp } from "lucide-react";

/* Unified Model Diagnostic Report — two columns:
   LEFT  · everything the hive-sound (audio) model predicts: queen + behavior
   RIGHT · diseases & health predicted by the bee-photo model, in full detail
   (uploaded photos are bee close-ups — there is no hive-frame photo).
   SIMPLE color logic:
   green = good (present/Healthy/Low/score>=75)
   amber = warning (Moderate/Medium/50-75)
   red   = bad (absent/High/score<50) */

function scoreTone(s) {
  s = Number(s) || 0;
  if (s >= 75) return "good";
  if (s >= 50) return "warn";
  return "bad";
}
function sevTone(sev = "") {
  if (sev.startsWith("High")) return "bad";
  if (sev.startsWith("Moderate") || sev === "Medium") return "warn";
  return "good";
}
function swarmTone(risk = "") {
  if (risk.startsWith("High")) return "bad";
  if (risk.startsWith("Moderate")) return "warn";
  return "good";
}
const CHIP = {
  good: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  bad: "bg-rose-100 text-rose-700",
};
const pct = (c) => `${(Math.max(0, Math.min(1, Number(c) || 0)) * 100).toFixed(1)}%`;
const hz = (v) => (v == null || Number.isNaN(Number(v)) ? "—" : `${Number(v).toFixed(1)} Hz`);

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-xs font-medium text-stone-500">{label}</span>
      <span className="text-right font-semibold text-stone-800">{children}</span>
    </div>
  );
}

/* Plain-language meaning of the bee-photo model's verdict. */
function noteForIssue(issue = "") {
  if (!issue) return "";
  if (issue === "Healthy")
    return "No significant pests or anomalies visible on the bees in this photo.";
  if (issue.includes("Varroa") && issue.includes("Beetle"))
    return "Varroa mites and hive beetles detected — monitor the mite load, treat above threshold and use beetle traps.";
  if (issue.includes("Varroa"))
    return "Varroa mites detected — monitor mite load and treat if thresholds are exceeded.";
  if (issue.includes("Beetle"))
    return "Small hive beetles detected — keep the colony strong and consider beetle traps.";
  if (issue === "Ant Problems")
    return "Ant activity detected — protect the hive stand (oil moats) and check entrances and feeders.";
  if (issue === "Robbing Bugs")
    return "Robbing behaviour detected — narrow the entrance and guard against robbing pressure.";
  if (issue === "Queenless Signs in Photo" || issue === "Missing Queen")
    return "Photo shows queenless signs (spotty brood / no eggs) — a visual clue only; queen presence itself is decided by the hive-sound cards on the left.";
  return "Pay extra attention during your next inspection.";
}
export default function ReportCard({ result, delay = 0.05 }) {
  const queen = result?.queen_analysis;
  const health = result?.health_analysis;
  const m = result?.hive_behavior_metrics;
  const f = result?.predictive_forecasting;
  const present = queen?.presence === "Present";
  const qTone = present ? "good" : "bad";
  const hTone = sevTone(health?.severity_level || "");
  const sTone = swarmTone(m?.swarming_risk || "");
  const score = Math.max(0, Math.min(100, Number(m?.colony_stability_score) || 0));
  const gTone = scoreTone(score);
  const acc = present ? Math.max(0, Math.min(100, Number(queen?.acceptance_rate_pct) || 0)) : 0;

  // Full probability vector from the bee-photo model — every class it scores.
  const topLabel = health?.raw_model_label || health?.detected_issue || "";
  const probs = Object.entries(health?.all_probabilities || {})
    .map(([label, p]) => [label, Math.max(0, Math.min(1, Number(p) || 0))])
    .sort((a, b) => b[1] - a[1]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
      aria-label="Unified model diagnostic report"
      className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white/85 shadow-sm backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-amber-100 bg-amber-50/60 px-5 py-4">
        <h2 className="text-base font-bold tracking-tight text-stone-800">
          Unified Model Diagnostic Report
        </h2>
        <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${CHIP[gTone]}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Stability {Math.round(score)}/100
        </span>
      </div>

      <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
        {/* ==================== LEFT · FROM HIVE SOUND ==================== */}
        <div className="flex flex-col gap-4">
          {/* Queen card — full audio-model readout */}
          <div className="rounded-xl border border-amber-100 bg-white p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <Crown className="h-4 w-4 text-amber-600" aria-hidden="true" />
              Queen · from hive sound
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP[qTone]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {present ? "Queen Present" : "Queen Absent"}
              </span>
              <span className="text-xs text-stone-500">conf. {pct(queen?.confidence)}</span>
            </div>
            <p className="mt-2 text-sm font-bold text-stone-800">{queen?.status || "—"}</p>
            <div className="mt-2 divide-y divide-amber-50">
              <Row label="Acceptance chance">
                <span className="tabular-nums">{acc.toFixed(1)}%</span>
              </Row>
              <Row label="Sound frequency"><span className="tabular-nums">{hz(m?.agitation_frequency_hz)}</span></Row>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-100">
              <motion.div
                className={`h-full rounded-full ${present ? "bg-emerald-500" : "bg-stone-300"}`}
                style={{ transformOrigin: "left" }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.max(acc, present ? 1 : 0) / 100 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            {(queen?.acceptance_reason || !present) && (
              <p className="mt-2 rounded-lg bg-stone-100 px-3 py-2 text-[11px] leading-relaxed text-stone-600">
                {queen?.acceptance_reason ||
                  "No queen present, so acceptance is 0% — there is no queen to accept."}
              </p>
            )}
          </div>

          {/* Hive behavior card — the remaining sound-derived metrics */}
          <div className="rounded-xl border border-amber-100 bg-white p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <Activity className="h-4 w-4 text-sky-600" aria-hidden="true" />
              Hive behavior · from hive sound
            </p>
            <div className="mt-2 divide-y divide-amber-50">
              <Row label="Agitation frequency"><span className="tabular-nums">{hz(m?.agitation_frequency_hz)}</span></Row>
              <Row label="Swarming risk">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP[sTone]}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {m?.swarming_risk || "—"}
                </span>
              </Row>
              <Row label="Stability score"><span className="tabular-nums">{score.toFixed(1)} / 100</span></Row>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
              Agitation and swarming risk come from the hive recording; the stability
              score combines the sound verdict with the bee-photo health read.
            </p>
          </div>
        </div>

        {/* ============== RIGHT · FROM BEE PHOTO (FULL DETAILS) ============== */}
        <div className="flex flex-col gap-4">
          {/* Diseases & health card — bee-photo model only, in full detail */}
          <div className="rounded-xl border border-amber-100 bg-white p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <Leaf className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Diseases &amp; health · from bee photo
            </p>
            {health ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP[hTone]}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {health?.severity_level || "—"}
                  </span>
                  <span className="text-xs text-stone-500">conf. {pct(health?.confidence)}</span>
                </div>
                <p className="mt-2 text-sm font-bold text-stone-800">{health?.detected_issue || "—"}</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">
                  {noteForIssue(health?.detected_issue || "")}
                </p>
                <p className="mt-1 text-[11px] text-stone-400">
                  {health?.source_label || "Bee photo visual inspection (bee disease model)"}
                  {health?.model_file ? ` · ${health.model_file}` : ""}
                </p>

                {/* Full model output — every class, sorted by probability */}
                {probs.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                      Full model output · all classes
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {probs.map(([label, p]) => {
                        const isTop = label === topLabel;
                        return (
                          <li key={label} className="flex items-center gap-2">
                            <span
                              className={`w-[45%] shrink-0 truncate text-[11px] ${
                                isTop ? "font-bold text-stone-800" : "text-stone-500"
                              }`}
                              title={label}
                            >
                              {label}
                            </span>
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-100">
                              <span
                                className={`block h-full rounded-full ${
                                  isTop ? "bg-emerald-500" : "bg-stone-300"
                                }`}
                                style={{ width: `${Math.round(p * 100)}%` }}
                              />
                            </span>
                            <span
                              className={`w-12 shrink-0 text-right text-[11px] tabular-nums ${
                                isTop ? "font-bold text-stone-800" : "text-stone-500"
                              }`}
                            >
                              {pct(p)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <p className="mt-2 rounded-lg bg-stone-100 px-3 py-2 text-[11px] leading-relaxed text-stone-600">
                  Bee-photo model only — queen presence is decided by the hive-sound
                  cards on the left.
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm font-bold text-stone-700">No bee photo uploaded</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">
                  The disease &amp; health readout needs the bee-photo model — upload a
                  .jpg/.png photo to unlock this card.
                </p>
              </>
            )}
          </div>

          {/* 30-day forecast card */}
          <div className="rounded-xl border border-amber-100 bg-white p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <TrendingUp className="h-4 w-4 text-violet-600" aria-hidden="true" />
              30-day forecast
            </p>
            <p className="mt-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP[gTone]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {f?.colony_viability_30d || "—"}
              </span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              {f?.recommended_action || "Inspect the hive as soon as possible."}
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}