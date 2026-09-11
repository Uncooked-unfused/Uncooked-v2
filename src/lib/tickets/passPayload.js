/**
 * Shared parse/helpers for HMAC door passes (QR JSON).
 * Payload shape: { regId, eventId, userId, sig }
 */

export function parsePassPayload(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  // Prefer JSON object (what we encode in QR).
  try {
    const parsed = JSON.parse(text);
    const registrationId = String(parsed.regId || parsed.registrationId || "").trim();
    const eventId = String(parsed.eventId || "").trim();
    const userId = String(parsed.userId || "").trim();
    const sig = String(parsed.sig || "").trim();
    if (!registrationId || !userId || !sig) return null;
    return { registrationId, eventId, userId, sig };
  } catch {
    /* fall through */
  }

  // Compact pipe form: regId|eventId|userId|sig
  const parts = text.split("|").map((p) => p.trim());
  if (parts.length === 4 && parts.every(Boolean)) {
    return {
      registrationId: parts[0],
      eventId: parts[1],
      userId: parts[2],
      sig: parts[3],
    };
  }

  return null;
}

export function passMatchesEvent(pass, eventId) {
  if (!pass || !eventId) return false;
  if (!pass.eventId) return true;
  return pass.eventId === eventId;
}
