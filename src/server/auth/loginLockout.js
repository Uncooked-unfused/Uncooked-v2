import prisma from "@/lib/prisma";
import { LOGIN_LOCKOUT_MS, LOGIN_LOCKOUT_THRESHOLD } from "@/server/config/legal";
import { syncAuthAppMetadata } from "@/lib/supabase/admin";

export async function recordFailedLogin(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, authUserId: true, failedLoginAttempts: true },
  });
  if (!user) return null;

  const attempts = (user.failedLoginAttempts || 0) + 1;
  const lock = attempts >= LOGIN_LOCKOUT_THRESHOLD;
  const lockedUntil = lock ? new Date(Date.now() + LOGIN_LOCKOUT_MS) : undefined;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: attempts,
      ...(lock
        ? {
            lockedUntil,
            tokenVersion: { increment: 1 },
          }
        : {}),
    },
    select: { id: true, authUserId: true, failedLoginAttempts: true, lockedUntil: true, tokenVersion: true },
  });

  if (lock && updated.authUserId) {
    try {
      await syncAuthAppMetadata(updated.authUserId, {
        accountStatus: "LOCKED",
        lockedUntil: updated.lockedUntil,
      });
    } catch (err) {
      console.error("[LOGIN_LOCKOUT] claim sync failed:", err.message);
    }
  }

  return updated;
}

export async function clearFailedLogins(userId) {
  return prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
    select: { id: true, authUserId: true, role: true, tokenVersion: true },
  });
}
