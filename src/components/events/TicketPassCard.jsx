"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2, X } from "lucide-react";
import GoogleMapsButton from "@/components/ui/GoogleMapsButton";

const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => <div className="w-24 h-24 bg-zinc-200 rounded-lg animate-pulse" />,
  }
);

export default function TicketPassCard({ title, status, location, dateLabel, payload, passId }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="bg-background border border-border-subtle rounded-2xl p-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => payload && setOpen(true)}
          className="p-2 bg-white rounded-xl shrink-0 relative group"
          aria-label="Show fullscreen pass for door scan"
          disabled={!payload}
        >
          {payload ? (
            <QRCodeSVG value={payload} size={96} level="M" />
          ) : (
            <div className="w-24 h-24 bg-zinc-200 rounded-lg" />
          )}
          {payload && (
            <span className="absolute bottom-1 right-1 rounded-md bg-black/70 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-3 h-3" />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
            {status || "Confirmed"}
          </p>
          <h4 className="text-sm font-bold text-text-primary truncate">{title}</h4>
          <p className="text-[11px] text-text-secondary mt-1">{dateLabel}</p>
          <p className="text-[11px] text-text-secondary truncate">{location}</p>
          {location && (
            <div className="mt-1">
              <GoogleMapsButton
                location={location}
                label="Open in Maps"
                variant="badge"
                className="!py-0.5 !px-2 !text-[10px]"
              />
            </div>
          )}
          <p className="text-[10px] font-mono text-[var(--accent-orange)] mt-1.5 truncate">
            PASS {passId}
          </p>
          {payload && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-2 text-[11px] font-semibold text-[var(--accent-orange)] hover:underline"
            >
              Fullscreen for door scan
            </button>
          )}
        </div>
      </div>

      {open && payload && (
        <div
          className="fixed inset-0 z-[80] bg-white text-zinc-900 flex flex-col items-center justify-center p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen ticket pass"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 min-w-[44px] min-h-[44px] p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center"
            aria-label="Close fullscreen pass"
          >
            <X className="w-5 h-5" />
          </button>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-2">
            {status || "Confirmed"} · Show at door
          </p>
          <h3 className="text-base sm:text-lg font-bold text-center max-w-sm mb-4 px-2">{title}</h3>
          <div className="p-3 sm:p-4 bg-white rounded-3xl border border-zinc-200 shadow-xl">
            {/* Fixed QR size keeps decode reliable on all phones without huge canvases */}
            <QRCodeSVG value={payload} size={220} level="M" includeMargin />
          </div>
          <p className="text-sm text-zinc-600 mt-4">{dateLabel}</p>
          <p className="text-sm text-zinc-600 truncate max-w-sm px-2">{location}</p>
          <p className="text-xs font-mono text-orange-600 mt-3">PASS {passId}</p>
          <p className="text-[11px] text-zinc-500 mt-6 text-center max-w-xs px-2">
            Raise brightness and hold steady for the host scanner.
          </p>
        </div>
      )}
    </>
  );
}
