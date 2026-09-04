import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rebuildAdaptiveSnapshot } from "@/lib/adaptive-current-snapshot";
import { hashPlanningSnapshot } from "@/lib/adaptive-proposals";
import { verifyAdaptiveConfirmation } from "@/lib/adaptive-token";

const inputSchema = z.object({ confirmationToken: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid confirmation request" }, { status: 400 });
  }

  const claims = verifyAdaptiveConfirmation(parsed.data.confirmationToken, session.user.id);
  if (!claims || hashPlanningSnapshot(claims.snapshot) !== claims.snapshotHash) {
    return NextResponse.json({ error: "Confirmation expired or invalid" }, { status: 409 });
  }

  const currentSnapshot = await rebuildAdaptiveSnapshot(session.user.id, claims.snapshot);
  const stale = hashPlanningSnapshot(currentSnapshot) !== claims.snapshotHash;
  if (stale) {
    return NextResponse.json(
      { valid: false, stale: true, error: "Your Today plan changed. Generate a fresh proposal." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { valid: true, stale: false, proposalId: claims.proposalId },
    { headers: { "Cache-Control": "no-store" } },
  );
}
