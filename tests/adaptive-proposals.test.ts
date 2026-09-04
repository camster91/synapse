import assert from "node:assert/strict";
import test from "node:test";
import {
  ADAPTIVE_PROPOSAL_TTL_MS,
  createAdaptiveProposal,
  isAdaptiveProposalExpired,
  proposalMatchesSnapshot,
} from "../src/lib/adaptive-proposals";

const createdAt = new Date("2026-09-03T16:00:00.000Z");
const snapshot = {
  now: createdAt.toISOString(),
  remainingMinutes: 90,
  capacity: "normal" as const,
  calendarBusyMinutes: 15,
  items: [{
    id: "task-1",
    priority: 5,
    dueAt: "2026-09-03T20:00:00.000Z",
    estimatedMinutes: 45,
    minimumMinutes: 20,
    goalId: "goal-1",
    completed: false,
    moveTargetAt: "2026-09-04T13:00:00.000Z",
    dropUntil: "2026-09-04T04:00:00.000Z",
    updatedAt: "2026-09-03T15:59:00.000Z",
  }],
};

test("proposal wraps a deterministic plan with bounded preview metadata", () => {
  const proposal = createAdaptiveProposal(snapshot, createdAt);
  assert.equal(proposal.plan.recommendations[0]?.action, "keep");
  assert.match(proposal.id, /^[0-9a-f-]{36}$/i);
  assert.equal(new Date(proposal.expiresAt).getTime() - createdAt.getTime(), ADAPTIVE_PROPOSAL_TTL_MS);
  assert.equal(proposalMatchesSnapshot(proposal, snapshot), true);
});

test("effort bounds and server-derived targets participate in stale detection", () => {
  const proposal = createAdaptiveProposal(snapshot, createdAt);
  assert.equal(proposalMatchesSnapshot(proposal, {
    ...snapshot,
    items: [{ ...snapshot.items[0], minimumMinutes: 15 }],
  }), false);
  assert.equal(proposalMatchesSnapshot(proposal, {
    ...snapshot,
    items: [{ ...snapshot.items[0], moveTargetAt: "2026-09-05T13:00:00.000Z" }],
  }), false);
});

test("task revisions participate in stale detection", () => {
  const proposal = createAdaptiveProposal(snapshot, createdAt);
  assert.equal(proposalMatchesSnapshot(proposal, {
    ...snapshot,
    items: [{ ...snapshot.items[0], updatedAt: "2026-09-03T16:01:00.000Z" }],
  }), false);
});

test("proposal expiry fails closed", () => {
  const proposal = createAdaptiveProposal(snapshot, createdAt);
  assert.equal(isAdaptiveProposalExpired(proposal, createdAt), false);
  assert.equal(isAdaptiveProposalExpired(
    proposal,
    new Date(createdAt.getTime() + ADAPTIVE_PROPOSAL_TTL_MS),
  ), true);
});
