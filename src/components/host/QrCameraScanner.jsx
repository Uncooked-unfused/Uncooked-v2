"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { getScanProfile } from "@/lib/device/scanCapability";

/**
 * Live QR reader tuned for low-end and high-end phones.
 * - Native BarcodeDetector when available (cheapest)
 * - jsQR fallback with downscaled frames + frame skipping
 * - Pauses when tab hidden; releases camera on stop
 */
export default function QrCameraScanner({ onScan, active = true, cooldownMs }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastHitRef = useRef({ value: "", at: 0 });
  const profileRef = useRef(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(false);
  const [tier, setTier] = useState("mid");

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = 0;
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
      const cool =
        typeof cooldownMs === "number"
          ? cooldownMs
          : profileRef.current?.cooldownMs || 2500;
      if (value === lastHitRef.current.value && now - lastHitRef.current.at < cool) {
        return;
      }
      lastHitRef.current = { value, at: now };
      onScan?.(value);
    },
    [cooldownMs, onScan]
  );

  const loopWithDetector = useCallback(
    (detector) => {
      const interval = profileRef.current?.detectorIntervalMs || 140;
      const tick = async () => {
        if (typeof document !== "undefined" && document.hidden) {
          timerRef.current = setTimeout(tick, interval * 2);
          return;
        }
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            if (codes?.[0]?.rawValue) emit(codes[0].rawValue);
          } catch {
            /* transient */
          }
        }
        timerRef.current = setTimeout(tick, interval);
      };
      timerRef.current = setTimeout(tick, interval);
    },
    [emit]
  );

  const loopWithJsQR = useCallback(async () => {
    const jsQR = (await import("jsqr")).default;
    const maxEdge = profileRef.current?.decodeMaxEdge || 560;
    const frameSkip = profileRef.current?.frameSkip || 2;

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      frameCountRef.current += 1;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (frameCountRef.current % (frameSkip + 1) === 0) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw && vh) {
          const scale = Math.min(1, maxEdge / Math.max(vw, vh));
          const w = Math.max(1, Math.round(vw * scale));
          const h = Math.max(1, Math.round(vh * scale));
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          const ctx = canvas.getContext("2d", {
            willReadFrequently: true,
            alpha: false,
          });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const image = ctx.getImageData(0, 0, w, h);
            const code = jsQR(image.data, w, h, { inversionAttempts: "dontInvert" });
            if (code?.data) emit(code.data);
          }
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
    const profile = getScanProfile(navigator);
    profileRef.current = profile;
    setTier(profile.tier);

    setStarting(true);
    setError("");
    stop();
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: profile.video,
        });
      } catch {
        // Ultra-fallback for stubborn / old WebViews
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "environment" },
        });
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element missing");
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
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
          /* jsQR fallback */
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

  useEffect(() => {
    const onVis = () => {
      // Restart decode loops cheaply when returning to tab
      if (!document.hidden && active && running && !rafRef.current && !timerRef.current) {
        start();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [active, running, start]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-black aspect-[4/3] max-h-[55vh]">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
          disablePictureInPicture
        />
        <canvas ref={canvasRef} className="hidden" aria-hidden />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[56%] w-[56%] max-w-[240px] max-h-[240px] rounded-2xl border-2 border-[var(--accent-orange)]/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
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
                <CameraOff className="w-6 h-6 text-zinc-400" />
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
          className="inline-flex items-center gap-2 min-h-[40px] rounded-full px-4 py-2 text-xs font-semibold border border-border-subtle bg-card hover:bg-card-hover text-text-primary"
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
          Mode: <span className="font-semibold text-text-secondary">{tier}</span>
          {" · "}
          Point at the student QR. Duplicates are ignored briefly.
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
