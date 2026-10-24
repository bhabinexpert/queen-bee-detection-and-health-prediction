import { motion } from "framer-motion";
import { AudioWaveform, Crown, Info, MicOff } from "lucide-react";
import ConfidenceBar, { TONES } from "./ConfidenceBar.jsx";

/**
 * Queen Presence Card (AUDIO ONLY).
 * - Presence verdict comes from the sound-frequency model, not the photo.
 * - Acceptance: queen present -> model confidence %; queen absent -> 0%
 *   with the reason spelled out (no queen = no chance of acceptance).
 * - Renders an explicit placeholder when no audio was uploaded.
 */
function swarmTone(risk = "") {
  if (risk.startsWith("High")) return "bad";
  if (risk.startsWith("Moderate")) return "warn";
  return "good";
}

export function QueenEmpty({ delay = 0.05 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
      className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-amber-300/80 bg-amber-50/50 p-5"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700">
        <MicOff className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
        Queen presence · no recording
      </p>
      <p className="text-sm font-bold text-stone-700">No hive sound uploaded</p>
      <p className="text-xs leading-relaxed text-stone-500">
        Queen presence and swarm acceptance need the audio model. Upload a .wav/.mp3
        recording to unlock this card.
      </p>
    </motion.div>
  );
}

export default function QueenCard({ queen, metrics, delay = 0.05 }) {
  const present = queen?.presence === "Present";
  const tone = present ? "good" : "bad";
  const t = TONES[tone];
  const sTone = swarmTone(metrics?.swarming_risk || "");
  const s = TONES[sTone];
  const acceptance = present
    ? Math.max(0, Math.min(100, Number(queen?.acceptance_rate_pct) || 0))
    : 0;
  const hz = metrics?.agitation_frequency_hz;
  const reason =
    queen?.acceptance_reason ||
    (present
      ? "Queen acoustic signature detected in the hive recording, so acceptance follows model confidence."
      : "No queen acoustic signature found — with no queen present there is no chance of queen acceptance (0%).");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
      className="flex flex-col rounded-2xl border border-amber-200/70 bg-white/85 p-5 shadow-sm backdrop-blur-sm"
    >
      {/* Header: audio source + presence badge */}
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${t.iconWrap}`}>
          <Crown className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Queen presence · from hive sound
          </p>
          <p className="text-[11px] text-stone-400">Audio model only — not the photo</p>
        </div>
        <span className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${t.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
          {present ? "Queen Present" : "Queen Absent"}
        </span>
      </div>

      {/* Presence verdict */}
      <p className="mt-3 text-base font-bold text-stone-800">{queen?.status || "—"}</p>
      <p className="mt-1 text-xs leading-relaxed text-stone-500">
        {present
          ? `Queen piping signature detected at ${hz != null ? `${Number(hz).toFixed(1)} Hz` : "measured frequency"} — colony is queen-right.`
          : `No queen signature at ${hz != null ? `${Number(hz).toFixed(1)} Hz` : "measured frequency"} — pattern matches a queenless roar.`}
      </p>

      {/* Acceptance: locked to presence */}
      <div
        className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-3"
        role="group"
        aria-label={present ? `Queen acceptance rate ${acceptance}%` : "Queen acceptance rate 0 percent, queen absent"}
      >
        <div
          className="mt-0"
          role="progressbar"
          aria-label={`Queen acceptance rate ${acceptance}%`}
          aria-valuenow={Math.round(acceptance)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-2 w-full overflow-hidden rounded-full bg-amber-100">
            <motion.div
              className={`block h-full rounded-full ${present ? t.bar : "bg-stone-300"}`}
              style={{ transformOrigin: "left" }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.max(acceptance, present ? 1 : 0) / 100 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-stone-500">Swarm queen-acceptance chance</span>
            <span className={`font-bold tabular-nums ${present ? t.text : "text-stone-500"}`}>
              {acceptance.toFixed(1)}%
            </span>
          </div>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-stone-500">
          <Info className="mt-px h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden="true" />
          <span>{reason}</span>
        </p>
      </div>

      {/* Acoustic telemetry */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-amber-50 px-3 py-2.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            <AudioWaveform className="h-3.5 w-3.5" aria-hidden="true" /> Sound freq.
          </p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-stone-800">
            {hz != null ? `${Number(hz).toFixed(1)} Hz` : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Swarming risk</p>
          <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
            {metrics?.swarming_risk || "—"}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <ConfidenceBar value={queen?.confidence ?? 0} tone={tone} />
      </div>
    </motion.div>
  );
}


