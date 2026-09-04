import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rebuildAdaptiveSnapshot } from "@/lib/adaptive-current-snapshot";
import { hashPlanningSnapshot } from "@/lib/adaptive-proposals";
import {
  applyAdaptiveChange,
  type AdaptiveApplyRecommendation,
} from "@/lib/adaptive-storage";
import { verifyAdaptiveConfirmation } from "@/lib/adaptive-token";

const inputSchema = z.object({
  confirmationToken: z.string().min(1),
  selectedItemIds: z.array(z.string().min(1)).max(50),
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
  if (new Set(parsed.data.selectedItemIds).size !== parsed.data.selectedItemIds.length) {
    return NextResponse.json({ error: "Duplicate adaptive selection" }, { status: 400 });
  }

  const claims = verifyAdaptiveConfirmation(parsed.data.confirmationToken, session.user.id);
  if (!claims || hashPlanningSnapshot(claims.snapshot) !== claims.snapshotHash) {
    return NextResponse.json({ error: "Confirmation expired or invalid" }, { status: 409 });
  }

  const currentSnapshot = await rebuildAdaptiveSnapshot(session.user.id, claims.snapshot);
  if (hashPlanningSnapshot(currentSnapshot) !== claims.snapshotHash) {
    return NextResponse.json(
      { error: "Your Today plan changed. Generate a fresh proposal." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const proposedById = new Map(claims.plan.recommendations.map((item) => [item.itemId, item]));
  const snapshotById = new Map(claims.snapshot.items.map((item) => [item.id, item]));
  const recommendations: AdaptiveApplyRecommendation[] = [];
  for (const itemId of parsed.data.selectedItemIds) {
    const recommendation = proposedById.get(itemId);
    const snapshotItem = snapshotById.get(itemId);
    if (
      !recommendation ||
      recommendation.action === "keep" ||
      !snapshotItem?.updatedAt
    ) {
      return NextResponse.json(
        { error: "Selected item is not an applicable signed recommendation" },
        { status: 409 },
      );
    }
    recommendations.push({
      itemId,
      action: recommendation.action,
      targetScheduledAt: recommendation.targetScheduledAt,
      targetDeferredUntil: recommendation.targetDeferredUntil,
      targetEstimatedMinutes: recommendation.targetEstimatedMinutes,
      expectedUpdatedAt: snapshotItem.updatedAt,
    });
  }

  if (recommendations.length === 0) {
    return NextResponse.json(
      { applied: false, appliedCount: 0, changeId: null, undoExpiresAt: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await applyAdaptiveChange({
      userId: session.user.id,
      proposalId: claims.proposalId,
      recommendations,
    });
    return NextResponse.json(
      { applied: true, proposalId: claims.proposalId, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adaptive apply failed";
    const conflict = /changed|missing|duplicate|conflict|recommendation/i.test(message);
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 500 });
  }
}
