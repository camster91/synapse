import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { emailDeliveryConfigured } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, "ok" | "failed"> = {
    database: "failed",
    uploads: "failed",
    authenticationEmail: "failed",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    // Do not expose connection details.
  }

  try {
    await access(path.join(process.cwd(), "uploads"), constants.R_OK | constants.W_OK);
    checks.uploads = "ok";
  } catch {
    // Do not expose filesystem details.
  }

  if (emailDeliveryConfigured()) {
    checks.authenticationEmail = "ok";
  }

  const ready = Object.values(checks).every((value) => value === "ok");
  const timestamp = new Date().toISOString();
  const revision = process.env.RELEASE_REV || "development";

  if (!ready) {
    console.error(
      JSON.stringify({
        event: "readiness_failed",
        failedChecks: Object.entries(checks)
          .filter(([, value]) => value === "failed")
          .map(([name]) => name),
        timestamp,
        revision,
      })
    );
  }

  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      checks,
      timestamp,
      revision,
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
