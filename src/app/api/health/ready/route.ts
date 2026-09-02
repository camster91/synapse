import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const checks = { database: "pending", uploads: "pending" };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";

    await access(path.join(process.cwd(), "uploads"), constants.R_OK | constants.W_OK);
    checks.uploads = "ok";

    return NextResponse.json(
      {
        status: "ready",
        checks,
        timestamp: new Date().toISOString(),
        revision: process.env.RELEASE_REV || "development",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    console.error(
      JSON.stringify({
        event: "readiness_failed",
        checks,
        timestamp: new Date().toISOString(),
        revision: process.env.RELEASE_REV || "development",
      })
    );
    return NextResponse.json(
      { status: "not_ready", checks },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
