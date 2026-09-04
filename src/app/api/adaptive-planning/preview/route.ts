import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { loadAdaptivePlanningContext } from "@/lib/adaptive-context";
import { createAdaptiveProposal } from "@/lib/adaptive-proposals";
import { signAdaptiveConfirmation } from "@/lib/adaptive-token";

const inputSchema = z.object({
  remainingMinutes: z.number().int().min(0).max(24 * 60),
  capacity: z.enum(["low", "normal", "high"]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid adaptation request" }, { status: 400 });
  }

  const { snapshot, displayItems, timezone } = await loadAdaptivePlanningContext({
    userId: session.user.id,
    now: new Date(),
    remainingMinutes: parsed.data.remainingMinutes,
    capacity: parsed.data.capacity,
  });
  const proposal = createAdaptiveProposal(snapshot);
  const confirmationToken = signAdaptiveConfirmation({
    userId: session.user.id,
    proposalId: proposal.id,
    snapshotHash: proposal.snapshotHash,
    snapshot,
    expiresAt: proposal.expiresAt,
  });

  return NextResponse.json(
    { proposal, confirmationToken, displayItems, timezone },
    { headers: { "Cache-Control": "no-store" } },
  );
}
