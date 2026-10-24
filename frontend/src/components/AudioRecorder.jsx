import { useEffect, useRef, useState } from "react";
import { Disc3, LoaderCircle, Mic, Square, TriangleAlert } from "lucide-react";
import { buildWavFile } from "../lib/wav.js";

function pickMimeType() {
  const list = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  return list.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export default function AudioRecorder({ onRecorded, onError }) {
  const [state, setState] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const tickRef = useRef(null);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    streamRef.current?.getTracks?.().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
  }, []);

  async function startRecording() {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const msg = "Live recording is not supported in this browser. Please upload a file.";
      setError(msg);
      onError?.(msg);
      return;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start(250);
      setSeconds(0);
      setState("recording");
      tickRef.current = setInterval(() => setSeconds((n) => n + 1), 1000);
    } catch {
      setState("idle");
      const msg = "Microphone access was denied or is unavailable.";
      setError(msg);
      onError?.(msg);
    }
  }

  async function convertToWav(blob) {
    const buf = await blob.arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return new File([blob], `live-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
    const ctx = new Ctx();
    try {
      const dec = await ctx.decodeAudioData(buf.slice(0));
      const mixed = new Float32Array(dec.length);
      for (let ch = 0; ch < dec.numberOfChannels; ch += 1) {
        const d = dec.getChannelData(ch);
        for (let i = 0; i < dec.length; i += 1) mixed[i] += d[i] / dec.numberOfChannels;
      }
      return buildWavFile(mixed, dec.sampleRate, 1);
    } finally {
      try { await ctx.close(); } catch { /* ignore */ }
    }
  }
  async function stopRecording() {
    const rec = recorderRef.current;
    if (!rec || state !== "recording") return;
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setState("processing");
    await new Promise((res) => { rec.onstop = () => res(); try { rec.stop(); } catch { res(); } });
    streamRef.current?.getTracks?.().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
    streamRef.current = null;
    recorderRef.current = null;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (chunks.length === 0) { setSeconds(0); setState("idle"); return; }
    try {
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      const wav = await convertToWav(blob);
      setSeconds(0); setState("idle"); onRecorded(wav);
    } catch {
      setSeconds(0); setState("idle");
      const msg = "Could not process the recording. Try again or upload a file.";
      setError(msg); onError?.(msg);
    }
  }

  const mm = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="flex w-full flex-col items-center gap-2.5 py-4 text-center">
      {state === "recording" ? (
        <>
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
          </span>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-stone-800">{mm}</p>
          <div className="flex h-6 items-end gap-1" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i} className="eq-bar w-1 rounded-full bg-amber-500" style={{ animationDelay: `${i * 0.12}s`, height: "100%" }} />
            ))}
          </div>
          <p className="max-w-xs text-xs leading-relaxed text-stone-500">Hold your device near the hive entrance. Capture 10+ seconds, then stop.</p>
          <button type="button" onClick={stopRecording} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2.5 text-xs font-semibold text-stone-900 shadow-sm transition hover:brightness-105">
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Stop and use recording
          </button>
        </>
      ) : (
        <>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
            {state === "requesting" || state === "processing" ? (
              <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <Mic className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            )}
          </span>
          <p className="text-sm font-semibold text-stone-800">{state === "requesting" ? "Requesting microphone access" : state === "processing" ? "Processing recording" : "Record live audio"}</p>
          <p className="max-w-xs text-xs leading-relaxed text-stone-500">Capture from your microphone. Converted to WAV automatically.</p>
          {state === "idle" && (
            <button type="button" onClick={startRecording} className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-amber-700">
              <Disc3 className="h-4 w-4" aria-hidden="true" />
              Start recording
            </button>
          )}
        </>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
