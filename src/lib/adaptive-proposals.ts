import { createHash, randomUUID } from "node:crypto";
import {
  buildAdaptivePlan,
  type PlanningCapacity,
  type PlanningItem,
  type PlanningProposal,
  type PlanningSnapshot,
} from "@/lib/adaptive-planning";

export const ADAPTIVE_PROPOSAL_VERSION = 2;
export const ADAPTIVE_PROPOSAL_TTL_MS = 15 * 60 * 1000;

export interface AdaptiveProposalInput {
  now: string;
  remainingMinutes: number;
  capacity: PlanningCapacity;
  calendarBusyMinutes?: number;
  items: PlanningItem[];
}

export interface AdaptiveProposalPreview {
  id: string;
  version: number;
  snapshotHash: string;
  createdAt: string;
  expiresAt: string;
  plan: PlanningProposal;
}

function canonicalSnapshot(snapshot: PlanningSnapshot) {
  return JSON.stringify({
    now: snapshot.now,
    remainingMinutes: snapshot.remainingMinutes,
    capacity: snapshot.capacity,
    calendarBusyMinutes: snapshot.calendarBusyMinutes ?? 0,
    items: snapshot.items.map((item) => ({
      id: item.id,
      priority: item.priority,
      dueAt: item.dueAt ?? null,
      estimatedMinutes: item.estimatedMinutes ?? null,
      minimumMinutes: item.minimumMinutes ?? null,
      goalId: item.goalId ?? null,
      completed: item.completed ?? false,
      scheduledAt: item.scheduledAt ?? null,
      moveTargetAt: item.moveTargetAt ?? null,
      dropUntil: item.dropUntil ?? null,
    })),
  });
}

export function hashPlanningSnapshot(snapshot: PlanningSnapshot) {
  return createHash("sha256").update(canonicalSnapshot(snapshot)).digest("hex");
}

export function createAdaptiveProposal(
  input: AdaptiveProposalInput,
  createdAt = new Date(),
): AdaptiveProposalPreview {
  const snapshot: PlanningSnapshot = {
    now: input.now,
    remainingMinutes: input.remainingMinutes,
    capacity: input.capacity,
    calendarBusyMinutes: input.calendarBusyMinutes ?? 0,
    items: input.items,
  };

  return {
    id: randomUUID(),
    version: ADAPTIVE_PROPOSAL_VERSION,
    snapshotHash: hashPlanningSnapshot(snapshot),
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + ADAPTIVE_PROPOSAL_TTL_MS).toISOString(),
    plan: buildAdaptivePlan(snapshot),
  };
}

export function isAdaptiveProposalExpired(proposal: AdaptiveProposalPreview, now = new Date()) {
  const expiresAt = new Date(proposal.expiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime();
}

export function proposalMatchesSnapshot(
  proposal: AdaptiveProposalPreview,
  snapshot: PlanningSnapshot,
) {
  return proposal.version === ADAPTIVE_PROPOSAL_VERSION &&
    proposal.snapshotHash === hashPlanningSnapshot(snapshot);
}
