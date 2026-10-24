import { motion } from "framer-motion";

/**
 * Semantic tone presets used across the dashboard.
 * good = emerald (healthy / present) · warn = amber (caution) · bad = red (issue).
 */
export const TONES = {
  good: { bar: "bg-emerald-500", track: "bg-amber-100", text: "text-emerald-700", iconWrap: "bg-emerald-50 text-emerald-600", chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  warn: { bar: "bg-amber-500", track: "bg-amber-100", text: "text-amber-700", iconWrap: "bg-amber-50 text-amber-600", chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  bad: { bar: "bg-rose-500", track: "bg-amber-100", text: "text-rose-700", iconWrap: "bg-rose-50 text-rose-600", chip: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};

/**
 * Animated confidence progress bar.
 * @param {number} value confidence between 0 and 1
 * @param {"good"|"warn"|"bad"} tone color treatment
 */
export default function ConfidenceBar({ value = 0, tone = "good" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const t = TONES[tone] ?? TONES.good;

  return (
    <div
      className="w-full"
      role="progressbar"
      aria-label={`Confidence ${pct}%`}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-2 w-full overflow-hidden rounded-full ${t.track}`}>
        <motion.div
          className={`block h-full rounded-full ${t.bar}`}
          style={{ transformOrigin: "left" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: Math.max(pct, 1) / 100 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-stone-500">Confidence</span>
        <span className={`font-bold tabular-nums ${t.text}`}>{pct}%</span>
      </div>
    </div>
  );
}