import { motion } from "framer-motion";
import { ImageOff, ScanSearch } from "lucide-react";
import ConfidenceBar, { TONES } from "./ConfidenceBar.jsx";

/** Diseases & Health Card — BEE PHOTO ONLY.
 *  Issue + severity + confidence + the full class-probability vector from
 *  the bee-photo model (uploaded photos are bee close-ups). */

export function HealthEmpty({ delay = 0.12 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
      className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-amber-300/80 bg-amber-50/50 p-5"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700">
        <ImageOff className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
        Diseases &amp; health · no bee photo
      </p>
      <p className="text-sm font-bold text-stone-700">No bee photo uploaded</p>
      <p className="text-xs leading-relaxed text-stone-500">
        Pest and visual-health detection need the bee-photo model. Upload a .jpg/.png
        bee photo to unlock this card.
      </p>
    </motion.div>
  );
}

function toneForSeverity(severity = "") {
  if (severity.startsWith("High")) return "bad";
  if (severity.startsWith("Moderate") || severity === "Medium") return "warn";
  return "good";
}

function noteForIssue(issue = "") {
  if (issue === "Healthy") return "No significant pests or anomalies visible on the bees in this photo.";
  if (issue.includes("Varroa"))
    return "Varroa mites detected — monitor mite load and treat if thresholds are exceeded.";
  if (issue.includes("Beetle"))
    return "Small hive beetles detected — keep the colony strong and consider beetle traps.";
  if (issue === "Ant Problems") return "Ant activity detected — protect the hive stand and check entrances/feeders.";
  if (issue === "Robbing Bugs") return "Robbing behaviour detected — narrow the entrance and guard against robbing.";
  if (issue === "Queenless Signs in Photo" || issue === "Missing Queen")
    return "Photo shows queenless signs (spotty brood / no eggs). Queen presence itself is decided by the hive-sound card — confirm with a frame inspection.";
  return "Pay extra attention during your next inspection.";
}

export default function HealthCard({ health, delay = 0.12 }) {
  const tone = toneForSeverity(health?.severity_level || "");
  const t = TONES[tone];
  const topLabel = health?.raw_model_label || health?.detected_issue || "";
  const probs = Object.entries(health?.all_probabilities || {})
    .map(([label, p]) => [label, Math.max(0, Math.min(1, Number(p) || 0))])
    .sort((a, b) => b[1] - a[1]);
  const pctStr = (v) => `${(v * 100).toFixed(1)}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
      className="flex flex-col rounded-2xl border border-amber-200/70 bg-white/85 p-5 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${t.iconWrap}`}>
          <ScanSearch className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Diseases &amp; health · from bee photo
          </p>
          <p className="text-[11px] text-stone-400">Bee-photo model only — not the sound</p>
        </div>
        <span className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${t.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
          {health?.severity_level || "—"}
        </span>
      </div>

      <p className="mt-3 text-base font-bold text-stone-800">{health?.detected_issue || "—"}</p>
      <p className="mt-1 text-xs leading-relaxed text-stone-500">
        {noteForIssue(health?.detected_issue || "")}
      </p>
      <div className="mt-4">
        <ConfidenceBar value={health?.confidence ?? 0} tone={tone} />
      </div>

      {probs.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
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
                    {pctStr(p)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </motion.div>
  );
}