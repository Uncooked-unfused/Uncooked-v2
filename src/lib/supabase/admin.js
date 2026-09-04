import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("placeholder") || key.includes("placeholder")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Sync Prisma-backed claims into app_metadata (service-role only).
 * Never put privileged claims in user_metadata — clients can spoof that.
 *
 * @param {string} authUserId
 * @param {{ role?: string, accountStatus?: string, lockedUntil?: Date|string|null, tokenVersion?: number }} [claims]
 */
export async function syncAuthAppMetadata(
  authUserId,
  { role, accountStatus, lockedUntil, tokenVersion } = {}
) {
  if (!authUserId) return;
  const patch = {};
  if (role != null) patch.role = String(role || "USER").toUpperCase();
  if (accountStatus != null) patch.account_status = String(accountStatus).toUpperCase();
  if (tokenVersion != null) patch.token_version = Number(tokenVersion) || 0;
  if (lockedUntil !== undefined) {
    if (lockedUntil == null || lockedUntil === "") {
      patch.locked_until = null;
    } else {
      const d = lockedUntil instanceof Date ? lockedUntil : new Date(lockedUntil);
      patch.locked_until = Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
  }
  if (accountStatus && String(accountStatus).toUpperCase() === "ACTIVE" && lockedUntil === undefined) {
    patch.locked_until = null;
  }
  if (Object.keys(patch).length === 0) return;

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    app_metadata: patch,
  });
  if (error) {
    throw new Error(`Failed to sync app_metadata: ${error.message}`);
  }
}

export async function syncAuthAppRole(authUserId, role) {
  return syncAuthAppMetadata(authUserId, { role });
}

/**
 * Defense-in-depth session invalidation.
 * Admin signOut() requires a user JWT (not available on admin actions), so we:
 * 1) Rely on Prisma tokenVersion mismatch (checked in getAuthUserAndProfile)
 * 2) Optionally ban/unban the Auth user (locks password sign-in at GoTrue)
 */
export async function revokeAuthSessions(authUserId, { banDuration = null } = {}) {
  if (!authUserId) return;
  if (banDuration == null) return;
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    ban_duration: banDuration,
  });
  if (error) {
    throw new Error(`Failed to update auth ban state: ${error.message}`);
  }
}
