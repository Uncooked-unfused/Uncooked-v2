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
 */
export async function syncAuthAppMetadata(authUserId, { role, accountStatus } = {}) {
  if (!authUserId) return;
  const patch = {};
  if (role != null) patch.role = String(role || "USER").toUpperCase();
  if (accountStatus != null) patch.account_status = String(accountStatus).toUpperCase();
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
