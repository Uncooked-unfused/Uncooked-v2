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

  // Public body is intentionally minimal (no Redis/TLS recon leakage).
  const publicPayload = {
    status: database === "ok" ? "ok" : "degraded",
    database,
    latencyMs: Date.now() - started,
    time: new Date().toISOString(),
  };

  if (database !== "ok") {
    return jsonError("Service temporarily unavailable", 503, "DEPENDENCY_UNAVAILABLE");
  }

  if (isProd && !redisConfigured) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMIT_BACKEND_MISSING",
          message: "Shared rate limiting is required in production",
        },
        data: { status: "degraded", database: "ok" },
      },
      { status: 503 }
    );
  }

  if (isProd && tlsBypass) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "TLS_VERIFY_DISABLED",
          message: "TLS certificate verification must be enabled in production",
        },
        data: { status: "degraded", database: "ok" },
      },
      { status: 503 }
    );
  }

  return jsonOk(publicPayload);
}
