import prisma from "@/lib/prisma";
import { logAuditEvent } from "@/server/auth/audit";
import { getSupabaseAdmin, syncAuthAppMetadata } from "@/lib/supabase/admin";

async function deleteAuthIdentity(authUserId) {
  if (!authUserId) return { ok: true };
  const admin = getSupabaseAdmin();
  try {
    await syncAuthAppMetadata(authUserId, {
      accountStatus: "DELETED",
      lockedUntil: null,
      role: "USER",
    });
  } catch (err) {
    console.warn("[ERASURE] claim sync before delete:", err.message);
  }
  const { error } = await admin.auth.admin.deleteUser(authUserId);
  if (error) {
    // Already gone is success for idempotent retries.
    if (/not found|user not found/i.test(error.message || "")) {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Complete pending Auth deletion for already-anonymized users (#48).
 */
export async function reconcilePendingAuthErasure(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.deletedAt) return user;
  const pendingId = user.pendingAuthDeleteId || user.authUserId;
  if (!pendingId || user.authErasureStatus === "DONE") {
    return user;
  }
  const result = await deleteAuthIdentity(pendingId);
  if (!result.ok) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        authErasureStatus: "FAILED",
        pendingAuthDeleteId: pendingId,
        disabledReason: `DPDP erasure; auth delete pending: ${result.error}`,
      },
    });
  }
  return prisma.user.update({
    where: { id: userId },
    data: {
      authUserId: null,
      pendingAuthDeleteId: null,
      authErasureStatus: "DONE",
      disabledReason: "DPDP erasure",
    },
  });
}

export async function eraseUser(userId, { ipHash = null, actorId = null } = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  // Idempotent resume path
  if (user.deletedAt) {
    return reconcilePendingAuthErasure(userId);
  }

  const anonymizedEmail = `deleted+${userId}@invalid.local`;
  const authIdToDelete = user.authUserId || null;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.consentRecord.deleteMany({ where: { userId } });
    await tx.verificationToken
      .deleteMany({
        where: { identifier: user.email.toLowerCase() },
      })
      .catch(() => {});

    return tx.user.update({
      where: { id: userId },
      data: {
        name: "Deleted User",
        fullName: null,
        email: anonymizedEmail,
        passwordHash: null,
        phoneE164: null,
        dob: null,
        department: null,
        clubAssociation: null,
        interests: null,
        privacyNomineeName: null,
        privacyNomineeEmail: null,
        lastLoginIpHash: null,
        deletedAt: new Date(),
        deleteRequestedAt: new Date(),
        tokenVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: new Date(),
        disabledAt: new Date(),
        disabledReason: "DPDP erasure",
        pendingAuthDeleteId: authIdToDelete,
        authErasureStatus: authIdToDelete ? "PENDING" : "DONE",
        // Keep authUserId until remote delete succeeds (helps observability).
      },
    });
  });

  if (authIdToDelete) {
    const result = await deleteAuthIdentity(authIdToDelete);
    if (!result.ok) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          authErasureStatus: "FAILED",
          pendingAuthDeleteId: authIdToDelete,
          disabledReason: `DPDP erasure; auth delete pending: ${result.error}`,
        },
      });
      // Observable partial state — caller can retry; reconcilePendingAuthErasure completes it.
      const err = new Error(`Failed to delete auth identity: ${result.error}`);
      err.code = "AUTH_ERASURE_PENDING";
      err.userId = userId;
      throw err;
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        authUserId: null,
        pendingAuthDeleteId: null,
        authErasureStatus: "DONE",
        disabledReason: "DPDP erasure",
      },
    });
  }

  await logAuditEvent({
    actorId: actorId || userId,
    action: "USER_ERASE",
    entityType: "User",
    entityId: userId,
    ipHash,
    metadata: { reason: "data_principal_erasure", authErasureStatus: "DONE" },
  });

  return prisma.user.findUnique({ where: { id: userId } });
}

/** Ops helper: finish any FAILED/PENDING auth deletions. */
export async function reconcileAllPendingAuthErasures({ take = 50 } = {}) {
  const rows = await prisma.user.findMany({
    where: {
      deletedAt: { not: null },
      OR: [{ authErasureStatus: "PENDING" }, { authErasureStatus: "FAILED" }, { pendingAuthDeleteId: { not: null } }],
    },
    take,
    select: { id: true },
  });
  const results = [];
  for (const row of rows) {
    try {
      const user = await reconcilePendingAuthErasure(row.id);
      results.push({ id: row.id, status: user.authErasureStatus });
    } catch (err) {
      results.push({ id: row.id, status: "ERROR", error: err.message });
    }
  }
  return results;
}

export function exportUserPayload(user) {
  return {
    id: user.id,
    name: user.name,
    fullName: user.fullName,
    email: user.email,
    department: user.department,
    clubAssociation: user.clubAssociation,
    interests: user.interests,
    role: user.role,
    ageAttested18: user.ageAttested18,
    termsAcceptedAt: user.termsAcceptedAt,
    termsVersion: user.termsVersion,
    privacyAcceptedAt: user.privacyAcceptedAt,
    privacyVersion: user.privacyVersion,
    privacyNomineeName: user.privacyNomineeName,
    privacyNomineeEmail: user.privacyNomineeEmail,
    createdAt: user.createdAt,
    registrations: (user.registrations || []).map((reg) => ({
      id: reg.id,
      eventId: reg.eventId,
      eventTitle: reg.event?.title,
      status: reg.status,
      registeredAt: reg.registeredAt,
    })),
    hostApplication: user.hostApplication
      ? {
          id: user.hostApplication.id,
          organizationName: user.hostApplication.organizationName,
          organizationType: user.hostApplication.organizationType,
          status: user.hostApplication.status,
          createdAt: user.hostApplication.createdAt,
        }
      : null,
    opportunityApplications: (user.opportunityApps || []).map((app) => ({
      id: app.id,
      opportunityTitle: app.opportunity?.title,
      status: app.status,
      appliedAt: app.appliedAt,
    })),
    consents: (user.consents || []).map((c) => ({
      kind: c.kind,
      version: c.version,
      acceptedAt: c.acceptedAt,
    })),
  };
}
