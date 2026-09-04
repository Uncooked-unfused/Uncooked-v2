export function getClientIp(req) {
  // Prefer platform-attested client IP (Vercel).
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) {
    return vercel.split(",")[0].trim().slice(0, 64);
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim().slice(0, 64);
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // In production, prefer the rightmost hop (closest to our edge) to reduce
    // trivial leftmost XFF spoofing when platform headers are absent.
    if (process.env.NODE_ENV === "production" && parts.length > 0) {
      return parts[parts.length - 1].slice(0, 64);
    }
    if (parts.length > 0) {
      return parts[0].slice(0, 64);
    }
  }

  return "0.0.0.0";
}

/** Sync fingerprint for Edge rate-limit keys. Not a password hash. */
export function fingerprintIp(ip, secret = "") {
  const s = `${secret}:${ip || ""}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
