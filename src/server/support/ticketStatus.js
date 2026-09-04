export const SUPPORT_STATUSES = Object.freeze(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);

/** Allowed transitions. Same-status is a no-op allow. */
const TRANSITIONS = {
  OPEN: new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
  IN_PROGRESS: new Set(["IN_PROGRESS", "OPEN", "RESOLVED", "CLOSED"]),
  RESOLVED: new Set(["RESOLVED", "IN_PROGRESS", "CLOSED"]),
  CLOSED: new Set(["CLOSED", "OPEN"]), // reopen only to OPEN
};

export function normalizeSupportStatus(raw) {
  return String(raw || "").trim().toUpperCase();
}

/**
 * @returns {{ ok: true, status: string } | { ok: false, error: string }}
 */
export function validateSupportStatusTransition(fromRaw, toRaw) {
  const from = normalizeSupportStatus(fromRaw) || "OPEN";
  const to = normalizeSupportStatus(toRaw);
  if (!SUPPORT_STATUSES.includes(to)) {
    return {
      ok: false,
      error: `Invalid status. Allowed: ${SUPPORT_STATUSES.join(", ")}`,
    };
  }
  const allowed = TRANSITIONS[from] || TRANSITIONS.OPEN;
  if (!allowed.has(to)) {
    return {
      ok: false,
      error: `Illegal status transition from ${from} to ${to}`,
    };
  }
  return { ok: true, status: to };
}
