import assert from "node:assert/strict";
import test from "node:test";
import { buildAdaptivePlan } from "../src/lib/adaptive-planning";

const NOW = "2026-09-03T12:00:00-04:00";

test("keeps higher-value work first when time is constrained", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 60,
    capacity: "normal",
    items: [
      { id: "routine", priority: 2, estimatedMinutes: 30 },
      { id: "critical", priority: 5, estimatedMinutes: 45, dueAt: "2026-09-03T18:00:00-04:00" },
    ],
  });

  assert.equal(proposal.recommendations[0]?.itemId, "critical");
  assert.equal(proposal.recommendations[0]?.action, "keep");
  assert.equal(proposal.recommendations[1]?.action, "drop");
  assert.equal(proposal.noChange, false);
});

test("low capacity reduces effective usable minutes", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 100,
    capacity: "low",
    items: [{ id: "task", priority: 3, estimatedMinutes: 70 }],
  });

  assert.equal(proposal.effectiveMinutes, 60);
  assert.equal(proposal.recommendations[0]?.action, "drop");
  assert.ok(proposal.recommendations[0]?.reasonCodes.includes("low_capacity"));
});

test("calendar constraints reduce declared remaining time before capacity adjustment", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 120,
    calendarBusyMinutes: 60,
    capacity: "normal",
    items: [{ id: "task", priority: 4, estimatedMinutes: 75 }],
  });

  assert.equal(proposal.effectiveMinutes, 60);
  assert.equal(proposal.recommendations[0]?.action, "move");
});

test("keeps urgent unknown-effort work but flags the uncertainty", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 30,
    capacity: "normal",
    items: [
      {
        id: "urgent-unknown",
        priority: 5,
        estimatedMinutes: null,
        dueAt: "2026-09-03T15:00:00-04:00",
      },
    ],
  });

  assert.equal(proposal.recommendations[0]?.action, "keep");
  assert.ok(proposal.recommendations[0]?.reasonCodes.includes("unknown_effort"));
});

test("moves non-urgent unknown-effort work rather than inventing a duration", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 90,
    capacity: "normal",
    items: [{ id: "unknown", priority: 2, estimatedMinutes: null }],
  });

  assert.equal(proposal.recommendations[0]?.action, "move");
  assert.ok(proposal.recommendations[0]?.reasonCodes.includes("unknown_effort"));
});

test("goal linkage breaks relevance toward goal work without overriding a deadline", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 45,
    capacity: "normal",
    items: [
      { id: "goal", priority: 3, estimatedMinutes: 45, goalId: "goal-1" },
      {
        id: "deadline",
        priority: 3,
        estimatedMinutes: 45,
        dueAt: "2026-09-03T16:00:00-04:00",
      },
    ],
  });

  assert.equal(proposal.recommendations[0]?.itemId, "deadline");
  assert.equal(proposal.recommendations[0]?.action, "keep");
  assert.notEqual(proposal.recommendations[1]?.action, "keep");
});

test("completed items are excluded from replanning", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 60,
    capacity: "normal",
    items: [
      { id: "done", priority: 5, estimatedMinutes: 60, completed: true },
      { id: "open", priority: 2, estimatedMinutes: 30 },
    ],
  });

  assert.deepEqual(proposal.recommendations.map((item) => item.itemId), ["open"]);
});

test("stable input order is used as the deterministic tie breaker", () => {
  const proposal = buildAdaptivePlan({
    now: NOW,
    remainingMinutes: 30,
    capacity: "normal",
    items: [
      { id: "first", priority: 3, estimatedMinutes: 30 },
      { id: "second", priority: 3, estimatedMinutes: 30 },
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
      { id: "one", priority: 3, estimatedMinutes: 30 },
      { id: "two", priority: 2, estimatedMinutes: 45 },
    ],
  });

  assert.equal(proposal.noChange, true);
  assert.ok(proposal.recommendations.every((item) => item.action === "keep"));
});
