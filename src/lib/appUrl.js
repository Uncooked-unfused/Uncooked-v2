/**
 * Canonical public app origin for emails and OAuth redirects.
 * Never derive this from request Host / x-forwarded-* (reset-link poisoning).
 */
export function getAppBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");

  if (!raw || typeof raw !== "string") {
    throw new Error("NEXT_PUBLIC_APP_URL (or NEXTAUTH_URL) is not configured");
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL is not a valid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("NEXT_PUBLIC_APP_URL must be http(s)");
  }

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_APP_URL must use https in production");
  }

  return url.origin;
}
