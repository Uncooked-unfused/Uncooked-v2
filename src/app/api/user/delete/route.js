import prisma from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { jsonError, jsonOk, readJson, safeError } from "@/server/http/envelope";
import { enforceMutationGuards, requireUser } from "@/server/http/guards";
import { eraseUser } from "@/server/services/erasure";
import { getClientIp, hashIp } from "@/server/http/ip";
import { verifyPassword } from "@/server/utils/passwordUtils";

export async function POST(req) {
  try {
    const blocked = await enforceMutationGuards(req, {
      rateKey: "rl_user_delete",
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (blocked) return blocked;

    const auth = await requireUser();
    if (auth.error) return auth.error;

    const parsed = await readJson(req);
    if (parsed.error) return parsed.error;
    const password = parsed.body.password;
    if (!password || typeof password !== "string") {
      return jsonError("Current password is required to erase your account.", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { id: true, email: true, passwordHash: true, authUserId: true },
    });
    if (!user) {
      return jsonError("Unable to verify account ownership.", 400, "INVALID_STATE");
    }

    let ownershipVerified = false;

    // Preferred path: Supabase Auth password proof (covers migrated users).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && anonKey && !supabaseUrl.includes("placeholder") && user.email) {
      try {
        const supabase = createClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data, error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password,
        });
        if (!error && data?.user) {
          ownershipVerified = true;
        }
      } catch (err) {
        console.warn("[USER_DELETE] Supabase reauth failed:", err.message);
      }
    }

    // Legacy fallback for unmigrated accounts that still have passwordHash.
    if (!ownershipVerified && user.passwordHash) {
      ownershipVerified = await verifyPassword(password, user.passwordHash);
    }

    if (!ownershipVerified) {
      return jsonError("Incorrect password.", 403, "FORBIDDEN");
    }

    try {
      await eraseUser(auth.user.id, {
        actorId: auth.user.id,
        ipHash: hashIp(getClientIp(req)),
      });
    } catch (eraseErr) {
      if (eraseErr?.code === "AUTH_ERASURE_PENDING") {
        return jsonOk({
          message:
            "Your local account data was erased. Auth identity deletion is pending retry; sessions are invalidated.",
          authErasureStatus: "PENDING",
        });
      }
      throw eraseErr;
    }

    return jsonOk({
      message: "Your account and personal data have been erased. Session credentials are no longer valid.",
    });
  } catch (error) {
    return safeError(error, "Unable to erase account");
  }
}
