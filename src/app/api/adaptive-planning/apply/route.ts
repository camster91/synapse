import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { hashPlanningSnapshot } from "@/lib/adaptive-proposals";
import { buildAdaptivePlan } from "@/lib/adaptive-planning";
import { rebuildAdaptiveSnapshot } from "@/lib/adaptive-current-snapshot";
import { verifyAdaptiveConfirmation } from "@/lib/adaptive-token";
import { applyAdaptiveChange } from "@/lib/adaptive-storage";

const recommendationSchema = z.object({
  itemId: z.string().min(1),
  action: z.enum(["move", "drop"]),
  targetScheduledAt: z.string().datetime().optional(),
  targetDeferredUntil: z.string().datetime().optional(),
});

const inputSchema = z.object({
  confirmationToken: z.string().min(1),
  recommendations: z.array(recommendationSchema).max(50),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid adaptive apply request" }, { status: 400 });
  }

  const claims = verifyAdaptiveConfirmation(parsed.data.confirmationToken, session.user.id);
  if (!claims) {
    return NextResponse.json({ error: "Confirmation expired or invalid" }, { status: 409 });
  }

  if (hashPlanningSnapshot(claims.snapshot) !== claims.snapshotHash) {
    return NextResponse.json({ error: "Signed planning snapshot is invalid" }, { status: 409 });
  }

  const currentSnapshot = await rebuildAdaptiveSnapshot(session.user.id, claims.snapshot);
  if (hashPlanningSnapshot(currentSnapshot) !== claims.snapshotHash) {
    return NextResponse.json(
      { error: "Your Today plan changed. Generate a fresh proposal." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const proposal = buildAdaptivePlan(claims.snapshot);
  const proposedById = new Map(proposal.recommendations.map((recommendation) => [recommendation.itemId, recommendation]));
  const seen = new Set<string>();

  for (const accepted of parsed.data.recommendations) {
    if (seen.has(accepted.itemId)) {
      return NextResponse.json({ error: "Duplicate adaptive recommendation" }, { status: 400 });
    }
    seen.add(accepted.itemId);

    const proposed = proposedById.get(accepted.itemId);
    if (!proposed || proposed.action !== accepted.action) {
      return NextResponse.json({ error: "Accepted action does not match the signed proposal" }, { status: 409 });
    }

    if (accepted.action === "move" && !accepted.targetScheduledAt) {
      return NextResponse.json({ error: "Move requires an explicit target schedule" }, { status: 400 });
    }
    if (accepted.action === "drop" && !accepted.targetDeferredUntil) {
      return NextResponse.json({ error: "Drop requires an explicit bounded deferral" }, { status: 400 });
    }
  }

  try {
    const result = await applyAdaptiveChange({
      userId: session.user.id,
      proposalId: claims.proposalId,
      recommendations: parsed.data.recommendations,
    });

    return NextResponse.json(
      { applied: true, proposalId: claims.proposalId, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adaptive apply failed";
    const conflict = /changed|missing|duplicate|conflict/i.test(message);
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 500 });
  }
}
