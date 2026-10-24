import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AudioWaveform, Camera, CheckCircle2, FolderOpen, ImageIcon, Mic, Music4, OctagonAlert, UploadCloud, X } from "lucide-react";
import AudioRecorder from "./AudioRecorder.jsx";
import CameraCapture from "./CameraCapture.jsx";

const MAX_BYTES = 25 * 1024 * 1024;

const KINDS = {
  audio: { ext: [".wav", ".mp3"], accept: ".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg,audio/mp3", label: ".wav, .mp3", CardIcon: AudioWaveform, fileIcon: Music4, live: { id: "record", label: "Record live", Icon: Mic } },
  image: { ext: [".png", ".jpg", ".jpeg"], accept: ".png,.jpg,.jpeg,image/png,image/jpeg", label: ".png, .jpg, .jpeg", CardIcon: ImageIcon, fileIcon: ImageIcon, live: { id: "capture", label: "Use camera", Icon: Camera } },
};

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}

export default function UploadBox({ step, kind, title, description, file, onFile, onClear }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState("browse");
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const meta = KINDS[kind];

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function acceptFile(next) {
    if (!next) return;
    const ext = "." + (next.name.split(".").pop() || "").toLowerCase();
    if (!meta.ext.includes(ext)) { setError(`Unsupported file type. Please choose ${meta.label}.`); return; }
    if (next.size > MAX_BYTES) { setError("This file is larger than 25 MB."); return; }
    setError(null);
    onFile(next);
  }

  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  const openPicker = () => inputRef.current?.click();
  const tabs = [
    { id: "browse", label: "Upload file", Icon: FolderOpen },
    { id: meta.live.id, label: meta.live.label, Icon: meta.live.Icon },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut", delay: (step - 1) * 0.08 }}
      className="rounded-2xl border border-amber-200/70 bg-white/85 p-5 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 text-white">
          <meta.CardIcon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-stone-800">{title}</p>
            {file && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Ready
              </span>
            )}
          </div>
          <p className="truncate text-xs text-stone-500">{description}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">0{step}</span>
      </div>
      <div onDragOver={(e) => { stop(e); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { stop(e); setDragOver(false); setMode("browse"); acceptFile(e.dataTransfer.files?.[0]); }}
        className={`mt-4 rounded-xl border transition ${dragOver ? "border-amber-500 bg-amber-50" : "border-amber-200 bg-amber-50/60"}`}>
        <input ref={inputRef} type="file" accept={meta.accept} aria-label={title} className="sr-only"
          onChange={(e) => { acceptFile(e.target.files?.[0]); e.target.value = ""; }} />
        {file && previewUrl ? (
          <div className="p-3">
            {kind === "audio" ? (
              <audio controls preload="metadata" src={previewUrl} aria-label="Audio preview" className="w-full" />
            ) : (
              <img src={previewUrl} alt="Bee photo preview" className="h-44 w-full rounded-lg bg-amber-100 object-cover" />
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <meta.fileIcon className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium text-stone-700">{file.name}</span>
              <span className="shrink-0 tabular-nums text-stone-400">{formatBytes(file.size)}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onClear(); }} aria-label={`Remove ${file.name}`}
                className="shrink-0 rounded-full p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={openPicker}
                className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-1.5 text-[11px] font-semibold text-stone-900 shadow-sm transition hover:brightness-105">Replace</button>
              <button type="button" onClick={() => { onClear(); setMode(meta.live.id); }}
                className="shrink-0 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-50">{meta.live.label} again</button>
            </div>
          </div>
        ) : (
          <div className="p-3">
            <div className="mb-3 grid w-full grid-cols-2 gap-1 rounded-xl bg-amber-100 p-1 text-xs font-semibold">
              {tabs.map(({ id, label, Icon }) => (
                <button key={id} type="button" onClick={() => { setMode(id); setError(null); }}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 transition ${mode === id ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
            {mode === "browse" ? (
              <div role="button" tabIndex={0} onClick={openPicker}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); } }}
                className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-6 text-center transition hover:border-amber-500 hover:bg-amber-100">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-700">
                  <UploadCloud className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-stone-800">Drop your file here or click to browse</p>
                <p className="text-xs text-stone-500">Accepts {meta.label} · up to 25 MB</p>
              </div>
            ) : kind === "audio" ? (
              <AudioRecorder onRecorded={onFile} />
            ) : (
              <CameraCapture onCaptured={onFile} />
            )}
          </div>
        )}
      </div>
      {error && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600">
          <OctagonAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </motion.p>
      )}
    </motion.div>
  );
}