import { enforceMutationGuards } from "@/server/http/guards";
import { jsonOk, jsonError, readJson } from "@/server/http/envelope";

/**
 * Enumeration-safe probe. Always returns the same shape regardless of whether
 * the email exists. Kept only for backward-compatible clients; prefer not to call.
 */
export async function POST(req) {
  try {
    const blocked = await enforceMutationGuards(req, {
      rateKey: "rl_auth_check_user",
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (blocked) return blocked;

    const parsed = await readJson(req);
    if (parsed.error) return parsed.error;

    const email = String(parsed.body.email || "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
      return jsonError("Invalid email parameter", 400);
    }

    // Deliberately do not reveal existence.
    return jsonOk({ ok: true });
  } catch {
    return jsonOk({ ok: true });
  }
}
