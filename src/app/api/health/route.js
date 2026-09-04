import { NextResponse } from "next/server";
import { jsonOk, jsonError } from "@/server/http/envelope";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }

  const redisConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
  const isProd = process.env.NODE_ENV === "production";
  const tlsBypass = process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";

  const payload = {
    status: database === "ok" ? (isProd && !redisConfigured ? "degraded" : "ok") : "degraded",
    database,
    rateLimitBackend: redisConfigured ? "redis" : "memory",
    redisConfigured,
    tlsCertificateVerification: tlsBypass ? "disabled" : "enabled",
    verifiedHostsOnly: String(process.env.VERIFIED_HOSTS_ONLY || "").toLowerCase() === "true",
    latencyMs: Date.now() - started,
    time: new Date().toISOString(),
  };

  if (database !== "ok") {
    return jsonError("Service temporarily unavailable", 503, "DEPENDENCY_UNAVAILABLE");
  }

  // Production must use shared rate limits (#28).
  if (isProd && !redisConfigured) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMIT_BACKEND_MISSING",
          message: "Shared rate limiting (Upstash Redis) is required in production",
        },
        data: payload,
      },
      { status: 503 }
    );
  }

  // Production must not disable TLS verification (#39).
  if (isProd && tlsBypass) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "TLS_VERIFY_DISABLED",
          message: "NODE_TLS_REJECT_UNAUTHORIZED=0 is not allowed in production",
        },
        data: payload,
      },
      { status: 503 }
    );
  }

  return jsonOk(payload);
}
