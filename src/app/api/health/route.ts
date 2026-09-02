import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "alive",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      revision: process.env.RELEASE_REV || "development",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
