import { jsonOk, safeError } from "@/server/http/envelope";
import { enforceMutationGuards, requireSuperAdmin } from "@/server/http/guards";
import { reconcileAllPendingAuthErasures } from "@/server/services/erasure";

/** Ops endpoint to finish partial DPDP erasures (#48). */
export async function POST(req) {
  try {
    const blocked = await enforceMutationGuards(req, { rateKey: "rl_admin", limit: 10, windowMs: 60_000 });
    if (blocked) return blocked;
    const auth = await requireSuperAdmin();
    if (auth.error) return auth.error;

    const results = await reconcileAllPendingAuthErasures({ take: 50 });
    return jsonOk({
      message: "Erasure reconciliation completed",
      results,
    });
  } catch (error) {
    return safeError(error, "Unable to reconcile erasures");
  }
}
