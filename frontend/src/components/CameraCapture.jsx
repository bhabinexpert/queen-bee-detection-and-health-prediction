import { useEffect, useRef, useState } from "react";
import { Aperture, Camera, LoaderCircle, TriangleAlert } from "lucide-react";

function stopStream(stream) {
  try { stream?.getTracks?.().forEach((t) => { try { t.stop(); } catch { /* ignore */ } }); } catch { /* ignore */ }
}

/**
 * Live webcam capture.
 * Streams the camera into a preview <video>, then snapshots the latest
 * frame to a JPEG <File> via a canvas. Cleans up the stream on unmount.
 */
export default function CameraCapture({ onCaptured, onError }) {
  const [state, setState] = useState("idle"); // idle | requesting | active
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => stopStream(streamRef.current), []);

  useEffect(() => {
    if (state !== "active") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play?.().catch(() => { /* autoplay already running */ });
  }, [state]);

  async function openCamera() {
    setError(null);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setState("active");
    } catch {
      setState("idle");
      const message = "Camera access was denied or is unavailable in this browser.";
      setError(message);
      onError?.(message);
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    if (width <= 0 || height <= 0) {
      setError("Camera frame is not ready yet — try again in a moment.");
      return;
    }
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(video, 0, 0, width, height);
    void canvas.toBlob("image/jpeg", 0.92).then((blob) => {
      const file = new File([blob], `live-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      finish();
      setState("idle");
      onCaptured(file);
    });
  }

  function finish() {
    stopStream(streamRef.current);
    streamRef.current = null;
    try {
      videoRef.current.srcObject = null;
    } catch {
      /* ignore */
    }
  }

  function cancel() {
    finish();
    setState("idle");
  }

  return (
    <div className="flex w-full flex-col items-center gap-2.5 py-4 text-center">
      {state === "active" ? (
        <>
          <div className="relative w-full overflow-hidden rounded-xl border border-amber-200 bg-stone-900">
            <video ref={videoRef} muted playsInline autoPlay className="max-h-48 w-full object-cover" />
            <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-amber-900/70 px-2.5 py-1 text-[10px] font-semibold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
              LIVE PREVIEW
            </span>
          </div>
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
          <p className="text-xs text-stone-500">Position the hive in frame, then capture the photo.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={capturePhoto}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              <Aperture className="h-4 w-4" aria-hidden="true" />
              Capture photo
            </button>
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-5 py-2.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-50"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
            {state === "requesting" ? (
              <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            )}
          </span>
          <p className="text-sm font-semibold text-stone-800">{state === "requesting" ? "Requesting camera access" : "Capture live photo"}</p>
          <p className="max-w-xs text-xs leading-relaxed text-stone-500">Use your webcam. Saved as JPEG for the vision model.</p>
          {state !== "requesting" && (
            <button
              type="button"
              onClick={openCamera}
              className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-amber-700"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              Open camera
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