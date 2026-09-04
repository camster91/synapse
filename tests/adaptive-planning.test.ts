import assert from "node:assert/strict";
import test from "node:test";
import { buildAdaptivePlan } from "../src/lib/adaptive-planning";

const NOW = "2026-09-03T12:00:00-04:00";
const MOVE = "2026-09-04T13:00:00.000Z";
const DROP = "2026-09-04T04:00:00.000Z";

function targets() {
  return { moveTargetAt: MOVE, dropUntil: DROP };
}

test("keeps higher-value work first when time is constrained", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 60,
    capacity: "normal",
    items: [
      { id: "routine", priority: 2, estimatedMinutes: 30, ...targets() },
      { id: "critical", priority: 5, estimatedMinutes: 45, dueAt: "2026-09-03T18:00:00-04:00", ...targets() },
    ],
  });
  assert.equal(proposal.recommendations[0]?.itemId, "critical");
  assert.equal(proposal.recommendations[0]?.action, "keep");
  assert.equal(proposal.recommendations[1]?.action, "drop");
  assert.equal(proposal.recommendations[1]?.targetDeferredUntil, DROP);
});

test("low capacity reduces effective usable minutes", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 100,
    capacity: "low",
    items: [{ id: "task", priority: 3, estimatedMinutes: 70, ...targets() }],
  });
  assert.equal(proposal.effectiveMinutes, 60);
  assert.equal(proposal.recommendations[0]?.action, "drop");
  assert.ok(proposal.recommendations[0]?.reasonCodes.includes("low_capacity"));
});

test("calendar constraints reduce time before capacity adjustment", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 120,
    calendarBusyMinutes: 60,
    capacity: "normal",
    items: [{ id: "task", priority: 4, estimatedMinutes: 75, ...targets() }],
  });
  assert.equal(proposal.effectiveMinutes, 60);
  assert.equal(proposal.recommendations[0]?.action, "move");
  assert.equal(proposal.recommendations[0]?.targetScheduledAt, MOVE);
});

test("uses an explicit minimum viable effort before moving work", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 25,
    capacity: "normal",
    items: [{ id: "task", priority: 4, estimatedMinutes: 60, minimumMinutes: 20, ...targets() }],
  });
  assert.equal(proposal.recommendations[0]?.action, "shorten");
  assert.equal(proposal.recommendations[0]?.targetEstimatedMinutes, 20);
  assert.ok(proposal.recommendations[0]?.reasonCodes.includes("minimum_viable"));
});

test("never invents a shorter task without explicit minimum effort", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 25,
    capacity: "normal",
    items: [{ id: "task", priority: 4, estimatedMinutes: 60, minimumMinutes: null, ...targets() }],
  });
  assert.equal(proposal.recommendations[0]?.action, "move");
  assert.equal(proposal.recommendations[0]?.targetEstimatedMinutes, undefined);
});

test("only one important unknown-effort item can consume the reliable budget", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 90,
    capacity: "normal",
    items: [
      { id: "first", priority: 5, estimatedMinutes: null, ...targets() },
      { id: "second", priority: 5, estimatedMinutes: null, ...targets() },
    ],
  });
  assert.equal(proposal.recommendations[0]?.action, "keep");
  assert.equal(proposal.recommendations[1]?.action, "move");
});

test("moves non-urgent unknown-effort work rather than inventing duration", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 90,
    capacity: "normal",
    items: [{ id: "unknown", priority: 2, estimatedMinutes: null, ...targets() }],
  });
  assert.equal(proposal.recommendations[0]?.action, "move");
  assert.ok(proposal.recommendations[0]?.reasonCodes.includes("unknown_effort"));
});

test("goal linkage cannot override a close deadline", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 45,
    capacity: "normal",
    items: [
      { id: "goal", priority: 3, estimatedMinutes: 45, goalId: "goal-1", ...targets() },
      { id: "deadline", priority: 3, estimatedMinutes: 45, dueAt: "2026-09-03T16:00:00-04:00", ...targets() },
    ],
  });
  assert.equal(proposal.recommendations[0]?.itemId, "deadline");
  assert.equal(proposal.recommendations[0]?.action, "keep");
});

test("completed items are excluded and ties remain deterministic", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 30,
    capacity: "normal",
    items: [
      { id: "done", priority: 5, estimatedMinutes: 30, completed: true, ...targets() },
      { id: "first", priority: 3, estimatedMinutes: 30, ...targets() },
      { id: "second", priority: 3, estimatedMinutes: 30, ...targets() },
    ],
  });
  assert.deepEqual(proposal.recommendations.map((item) => item.itemId), ["first", "second"]);
  assert.equal(proposal.recommendations[0]?.action, "keep");
});

test("returns noChange when all remaining work fits", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 90,
    capacity: "normal",
    items: [
      { id: "one", priority: 3, estimatedMinutes: 30, ...targets() },
      { id: "two", priority: 2, estimatedMinutes: 45, ...targets() },
    ],
  });
  assert.equal(proposal.plannerVersion, 1);
  assert.equal(proposal.reasonCodeVersion, 1);
  assert.equal(proposal.noChange, true);
  assert.equal(proposal.requiresAttention, false);
  assert.ok(proposal.recommendations.every((item) => item.action === "keep"));
});

test("keeps a task visible when its deadline arrives before the safe move target", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 20,
    capacity: "normal",
    items: [{
      id: "deadline-conflict",
      priority: 3,
      estimatedMinutes: 60,
      dueAt: "2026-09-03T20:00:00-04:00",
      moveTargetAt: "2026-09-04T09:00:00-04:00",
    }],
  });

  assert.equal(proposal.recommendations[0]?.action, "keep");
  assert.ok(proposal.recommendations[0]?.reasonCodes.includes("deadline_conflict"));
  assert.equal(proposal.requiresAttention, true);
  assert.equal(proposal.noChange, false);
});
