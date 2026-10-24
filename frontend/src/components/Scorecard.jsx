import { motion } from "framer-motion";

/**
 * Colony Health Scorecard (hero) — circular stability gauge 0-100.
 * Green >75 · Yellow 50-75 · Red <50, plus 30-day viability banner.
 */
function toneFor(score) {
  if (score >= 75) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

const STYLES = {
  good: { ring: "#10b981", text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700", label: "Stable" },
  warn: { ring: "#f59e0b", text: "text-amber-700", chip: "bg-amber-50 text-amber-700", label: "Needs attention" },
  bad: { ring: "#f43f5e", text: "text-rose-700", chip: "bg-rose-50 text-rose-700", label: "Critical" },
};

// Circular gauge geometry.
const R = 54;
const CIRC = 2 * Math.PI * R;

export default function Scorecard({ score = 0, viability = "", action = "" }) {
  const safe = Math.max(0, Math.min(100, Number(score) || 0));
  const tone = toneFor(safe);
  const s = STYLES[tone];
  const offset = CIRC - (CIRC * safe) / 100;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      aria-label="Colony health scorecard"
      className="rounded-2xl border border-amber-200/70 bg-white/85 p-5 shadow-sm backdrop-blur-sm sm:p-6"
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        {/* Gauge */}
        <div className="relative h-36 w-36 shrink-0" role="img" aria-label={`Colony stability score ${Math.round(safe)} out of 100`}>
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
            <circle cx="64" cy="64" r={R} fill="none" strokeWidth="12" className="stroke-amber-100" />
            <motion.circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke={s.ring}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={{ strokeDashoffset: CIRC }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold tabular-nums tracking-tight ${s.text}`}>
              {Math.round(safe)}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              / 100 stable
            </span>
          </div>
        </div>

        {/* Banner copy */}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Colony Health Scorecard
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h2 className="text-xl font-bold tracking-tight text-stone-800">
              Colony Stability Score
            </h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.chip}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {s.label}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-stone-700">
            30-day viability: <span className={s.text}>{viability || "—"}</span>
          </p>
          {action && (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-stone-500">{action}</p>
          )}
        </div>
      </div>
    </motion.section>
  );
}
