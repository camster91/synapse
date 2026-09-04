import assert from "node:assert/strict";
import test from "node:test";
import { buildAdaptivePlan } from "../src/lib/adaptive-planning";
import {
  signAdaptiveConfirmation,
  verifyAdaptiveConfirmation,
} from "../src/lib/adaptive-token";

process.env.NEXTAUTH_SECRET = "adaptive-test-secret";

const now = new Date("2026-09-03T20:00:00.000Z");
const snapshot = {
  now: now.toISOString(),
  remainingMinutes: 90,
  capacity: "normal" as const,
  calendarBusyMinutes: 15,
  items: [{ id: "task-1", priority: 5, estimatedMinutes: 45 }],
};
const plan = buildAdaptivePlan(snapshot);

function token() {
  return signAdaptiveConfirmation({
    userId: "user-1",
    proposalId: "proposal-1",
    snapshotHash: "a".repeat(64),
    snapshot,
    plan,
    expiresAt: "2026-09-03T20:15:00.000Z",
  });
}

test("signed confirmation is bound to the user, snapshot, and exact proposal", () => {
  assert.equal(verifyAdaptiveConfirmation(token(), "user-2", now), null);
  const claims = verifyAdaptiveConfirmation(token(), "user-1", now);
  assert.equal(claims?.proposalId, "proposal-1");
  assert.deepEqual(claims?.snapshot, snapshot);
  assert.deepEqual(claims?.plan, plan);
});

test("signed claims using an unsupported planner version fail closed", () => {
  const invalid = signAdaptiveConfirmation({
    userId: "user-1",
    proposalId: "proposal-1",
    snapshotHash: "a".repeat(64),
    snapshot,
    plan: { ...plan, plannerVersion: plan.plannerVersion + 1 },
    expiresAt: "2026-09-03T20:15:00.000Z",
  });
  assert.equal(verifyAdaptiveConfirmation(invalid, "user-1", now), null);
});

test("tampered adaptive confirmation fails closed", () => {
  const original = token();
  const tampered = `${original.slice(0, -1)}${original.endsWith("a") ? "b" : "a"}`;
  assert.equal(verifyAdaptiveConfirmation(tampered, "user-1", now), null);
});

test("expired adaptive confirmation fails closed", () => {
  assert.equal(
    verifyAdaptiveConfirmation(token(), "user-1", new Date("2026-09-03T20:15:00.000Z")),
    null,
  );
});
