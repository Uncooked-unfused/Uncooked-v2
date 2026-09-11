"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";

/**
 * Live QR reader for door check-in.
 * Prefers BarcodeDetector; falls back to jsqr + canvas.
 */
export default function QrCameraScanner({ onScan, active = true, cooldownMs = 2500 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const lastHitRef = useRef({ value: "", at: 0 });
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(false);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setRunning(false);
  }, []);

  const emit = useCallback(
    (raw) => {
      const value = String(raw || "").trim();
      if (!value) return;
      const now = Date.now();
      if (value === lastHitRef.current.value && now - lastHitRef.current.at < cooldownMs) {
        return;
      }
      lastHitRef.current = { value, at: now };
      onScan?.(value);
    },
    [cooldownMs, onScan]
  );

  const loopWithDetector = useCallback(
    (detector) => {
      const tick = async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        try {
          const codes = await detector.detect(video);
          if (codes?.[0]?.rawValue) emit(codes[0].rawValue);
        } catch {
          /* transient frame errors */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [emit]
  );

  const loopWithJsQR = useCallback(async () => {
    const jsQR = (await import("jsqr")).default;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w && h) {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const image = ctx.getImageData(0, 0, w, h);
          const code = jsQR(image.data, w, h, { inversionAttempts: "dontInvert" });
          if (code?.data) emit(code.data);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [emit]);

  const start = useCallback(async () => {
    if (!active) return;
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setError("Camera is not available in this browser. Use paste fallback.");
      return;
    }
    setStarting(true);
    setError("");
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element missing");
      video.srcObject = stream;
      await video.play();
      setRunning(true);

      if (typeof window.BarcodeDetector === "function") {
        try {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          loopWithDetector(detector);
          setStarting(false);
          return;
        } catch {
          /* fall through to jsqr */
        }
      }
      await loopWithJsQR();
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Camera permission denied. Allow camera for this site, or paste the pass JSON.");
      } else if (name === "NotFoundError") {
        setError("No camera found on this device. Use paste fallback.");
      } else {
        setError("Unable to start camera. Use paste fallback.");
      }
      stop();
    } finally {
      setStarting(false);
    }
  }, [active, loopWithDetector, loopWithJsQR, stop]);

  useEffect(() => {
    if (active) start();
    else stop();
    return () => stop();
  }, [active, start, stop]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-black aspect-[4/3]">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[58%] w-[58%] rounded-2xl border-2 border-[var(--accent-orange)]/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white text-sm px-4 text-center">
            {starting ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-orange)]" />
                Starting camera…
              </>
            ) : (
              <>
                <CameraOff className="w-6 h-6 text-text-muted" />
                Camera idle
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => (running ? stop() : start())}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border border-border-subtle bg-card hover:bg-card-hover text-text-primary"
        >
          {running ? (
            <>
              <CameraOff className="w-3.5 h-3.5" /> Stop camera
            </>
          ) : (
            <>
              <Camera className="w-3.5 h-3.5" /> Start camera
            </>
          )}
        </button>
        <p className="text-[11px] text-text-muted">
          Point at the student QR. Duplicate scans are ignored for a few seconds.
        </p>
      </div>

      {error && (
        <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
