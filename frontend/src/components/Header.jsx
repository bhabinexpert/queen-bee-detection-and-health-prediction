import { Hexagon, Loader2, Wifi, WifiOff } from "lucide-react";

const STATUS = {
  checking: { label: "Connecting", cls: "bg-white/90 text-amber-800", dot: "bg-amber-500", Icon: Loader2, spin: true, pulse: false },
  connected: { label: "API Connected", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", Icon: Wifi, spin: false, pulse: true },
  offline: { label: "API Offline", cls: "bg-rose-50 text-rose-700", dot: "bg-rose-500", Icon: WifiOff, spin: false, pulse: false },
};

export default function Header({ status = "checking", onRefresh }) {
  const s = STATUS[status] ?? STATUS.checking;
  const { Icon } = s;

  return (
    <header className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 shadow-md">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20 text-white ring-1 ring-white/40">
            <Hexagon className="h-6 w-6" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-lg font-bold tracking-tight text-white drop-shadow-sm">Bee Monitor AI</h1>
            <p className="text-xs font-medium text-amber-50">Smart Beehive Health Monitor</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          title="Re-check API connection"
          className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition hover:opacity-80 ${s.cls}`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            {s.pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`} />
          </span>
          {s.label}
          <Icon className={`h-3.5 w-3.5 ${s.spin ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}