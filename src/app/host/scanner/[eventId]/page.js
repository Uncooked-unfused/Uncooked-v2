"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  QrCode,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Keyboard,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AccountNav from "@/components/account/AccountNav";
import QrCameraScanner from "@/components/host/QrCameraScanner";
import { parsePassPayload, passMatchesEvent } from "@/lib/tickets/passPayload";

const FIELD =
  "w-full bg-background border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[var(--accent-orange)]";

export default function HostScannerPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = String(params?.eventId || "");
  const [eventTitle, setEventTitle] = useState("");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({ checkedIn: 0, total: 0 });
  const [isHost, setIsHost] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);

  const preview = useMemo(() => parsePassPayload(raw), [raw]);

  const refreshStats = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
        credentials: "include",
      });
      const payload = await res.json();
      if (!res.ok) return;
      const dash = payload.data?.hostDashboard;
      if (dash) {
        setStats({
          checkedIn: Number(dash.checkedInCount) || 0,
          total: Number(dash.totalRegistrations) || 0,
        });
      }
    } catch {
      /* ignore */
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
          credentials: "include",
        });
        const payload = await res.json();
        if (cancelled) return;
        if (res.status === 401) {
          router.push(`/login?redirectTo=/host/scanner/${encodeURIComponent(eventId)}`);
          return;
        }
        if (!res.ok) {
          setError(payload.error?.message || "Event not found");
          return;
        }
        setEventTitle(payload.data?.event?.title || eventId);
        const host = Boolean(payload.data?.isHost);
        setIsHost(host);
        if (!host) {
          setError("Only the event host or an admin can use the door scanner.");
          setCameraOn(false);
          return;
        }
        const dash = payload.data?.hostDashboard;
        if (dash) {
          setStats({
            checkedIn: Number(dash.checkedInCount) || 0,
            total: Number(dash.totalRegistrations) || 0,
          });
        }
      } catch {
        if (!cancelled) setError("Unable to load event");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, router]);

  const checkInPass = useCallback(
    async (pass, { clearRaw = false } = {}) => {
      if (!pass?.registrationId || !pass?.userId || !pass?.sig) {
        setError("Invalid pass. Need regId, userId, and sig.");
        return;
      }
      if (!passMatchesEvent(pass, eventId)) {
        setError("This pass belongs to a different event.");
        return;
      }
      setBusy(true);
      setError("");
      setResult(null);
      try {
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/check-in`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Origin: typeof window !== "undefined" ? window.location.origin : "",
          },
          body: JSON.stringify({
            registrationId: pass.registrationId,
            userId: pass.userId,
            sig: pass.sig,
          }),
        });
        const payload = await res.json();
        if (res.status === 401) {
          router.push(`/login?redirectTo=/host/scanner/${encodeURIComponent(eventId)}`);
          return;
        }
        if (!res.ok) {
          setError(payload.error?.message || "Check-in failed");
          return;
        }
        setResult(payload.data);
        if (clearRaw) setRaw("");
        await refreshStats();
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(payload.data?.alreadyCheckedIn ? [40, 40, 40] : 80);
        }
      } catch {
        setError("Check-in failed. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [eventId, refreshStats, router]
  );

  const onCameraScan = useCallback(
    (rawValue) => {
      const pass = parsePassPayload(rawValue);
      if (!pass) {
        setError("Scanned code is not a valid Opportia pass.");
        return;
      }
      setRaw(rawValue.trim());
      checkInPass(pass, { clearRaw: true });
    },
    [checkInPass]
  );

  const submitPaste = async (e) => {
    e.preventDefault();
    const pass = parsePassPayload(raw);
    if (!pass) {
      setError("Paste a valid pass JSON from the attendee ticket (regId, eventId, userId, sig).");
      return;
    }
    await checkInPass(pass, { clearRaw: true });
  };

  return (
    <>
      <Navbar forceDarkTop />
      <main className="min-h-screen bg-primary pt-28 pb-24 relative overflow-hidden">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[280px] bg-orange-500/10 rounded-full blur-2xl md:blur-[140px] opacity-50 md:opacity-100 pointer-events-none" />
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 relative z-10">
          <AccountNav />

          <Link
            href={`/events/${encodeURIComponent(eventId)}`}
            className="inline-flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to event
          </Link>

          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent-orange)] mb-2">
              Door scanner
            </p>
            <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
              <QrCode className="w-8 h-8 text-[var(--accent-orange)]" />
              {loading ? "Loading…" : eventTitle || "Scanner"}
            </h1>
            <p className="text-sm text-text-secondary mt-2">
              Scan the student QR pass with this phone camera. HMAC signatures are verified server-side;
              each pass checks in once.
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-card border border-border-subtle p-4">
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Checked in</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.checkedIn}</p>
            </div>
            <div className="rounded-2xl bg-card border border-border-subtle p-4">
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Registered</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{stats.total}</p>
            </div>
          </div>

          {/* No Framer on this page — keep door phones light */}
          <div className="rounded-3xl bg-card border border-border-subtle p-5 sm:p-8 space-y-5">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Host or admin only. Invalid or forged passes are rejected.
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="flex items-start gap-2 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {result.alreadyCheckedIn ? "Already checked in: " : "Checked in: "}
                  <strong>{result.guestName}</strong>
                </span>
              </div>
            )}

            {isHost && !loading && (
              <>
                <QrCameraScanner
                  active={cameraOn && !busy}
                  onScan={onCameraScan}
                />

                <button
                  type="button"
                  onClick={() => setShowPaste((v) => !v)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  {showPaste ? "Hide paste fallback" : "Paste pass JSON (fallback)"}
                </button>

                {showPaste && (
                  <form onSubmit={submitPaste} className="space-y-3">
                    <textarea
                      className={`${FIELD} min-h-[110px] font-mono text-xs`}
                      value={raw}
                      onChange={(e) => setRaw(e.target.value)}
                      placeholder='{"regId":"...","eventId":"...","userId":"...","sig":"..."}'
                    />
                    {preview?.registrationId && (
                      <p className="text-[11px] text-text-muted">
                        Parsed reg {preview.registrationId.slice(0, 8)}… for event{" "}
                        {preview.eventId || eventId}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full min-h-[44px] rounded-full font-semibold text-sm text-white disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #ec4899 0%, #f97316 100%)" }}
                    >
                      {busy ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                        </span>
                      ) : (
                        "Verify and check in"
                      )}
                    </button>
                  </form>
                )}

                {busy && !showPaste && (
                  <p className="text-xs text-text-secondary inline-flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying pass…
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
