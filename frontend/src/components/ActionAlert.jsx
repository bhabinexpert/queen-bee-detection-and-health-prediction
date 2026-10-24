import { motion } from "framer-motion";
import { Bug, CheckCircle2, ClipboardList, Crown, OctagonAlert } from "lucide-react";

/**
 * Actionable Recommendations Alert Box — pulls predictive_forecasting text.
 * Iconography + color follow severity (stability score / viability).
 */
function severityOf(score, viability = "") {
  if (score < 50 || viability.startsWith("<40%")) return "bad";
  if (score < 75 || viability.includes("Moderate")) return "warn";
  return "good";
}

export default function ActionAlert({ score = 0, forecast, queen, health, delay = 0.2 }) {
  const safe = Math.max(0, Math.min(100, Number(score) || 0));
  const sev = severityOf(safe, forecast?.colony_viability_30d || "");
  const healthy = sev === "good";

  const wrap = healthy
    ? "border-emerald-200 bg-emerald-50"
    : sev === "warn"
      ? "border-amber-200 bg-amber-50"
      : "border-rose-200 bg-rose-50";
  const iconBox = healthy ? "bg-emerald-600 text-white" : sev === "warn" ? "bg-amber-500 text-white" : "bg-rose-600 text-white";
  const title = healthy ? "text-emerald-900" : sev === "warn" ? "text-amber-900" : "text-rose-900";
  const chip = healthy ? "bg-emerald-600 text-white" : sev === "warn" ? "bg-amber-500 text-white" : "bg-rose-600 text-white";

  const issues = [];
  if (queen && queen.presence === "Absent")
    issues.push({
      Icon: Crown,
      text: "No queen signal in the hive sound (queen absent) — so swarm queen-acceptance is 0%: there is no queen present to accept.",
    });
  if (health && health.detected_issue && health.detected_issue !== "Healthy")
    issues.push({
      Icon: Bug,
      text:
        health.detected_issue === "Queenless Signs in Photo"
          ? "Bee photo shows queenless signs (spotty brood / no eggs) — visual clue only; queen presence is decided by the hive-sound card."
          : `${health.detected_issue} detected in the bee photo (bee-photo vision model).`,
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
      className={`rounded-2xl border p-5 shadow-sm ${wrap}`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconBox}`}>
          {healthy ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <OctagonAlert className="h-6 w-6" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
            Actionable recommendations
          </p>
          <h3 className={`text-lg font-bold tracking-tight ${title}`}>
            {healthy ? "Colony operating normally" : "Beekeeper intervention needed"}
          </h3>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${chip}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {healthy ? "All clear" : sev === "warn" ? "Watch closely" : "Action required"}
        </span>
      </div>
      <div className="mt-4 rounded-xl bg-white p-3.5">
        {!healthy && issues.length > 0 && (
          <ul className="space-y-1.5">
            {issues.map(({ Icon, text }, i) => (
              <li key={i} className="flex items-start gap-2 text-sm font-medium text-stone-700">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-sm text-stone-600">
          {forecast?.recommended_action || "Inspect the hive as soon as possible."}
        </p>
      </div>
    </motion.div>
  );
}
