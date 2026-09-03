import assert from "node:assert/strict";
import test from "node:test";
import {
  signAdaptiveConfirmation,
  verifyAdaptiveConfirmation,
} from "../src/lib/adaptive-token";

process.env.NEXTAUTH_SECRET = "adaptive-test-secret";

const now = new Date("2026-09-03T20:00:00.000Z");

function token() {
  return signAdaptiveConfirmation({
    userId: "user-1",
    proposalId: "proposal-1",
    snapshotHash: "abc123",
    expiresAt: "2026-09-03T20:15:00.000Z",
  });
}

test("signed adaptive confirmation is bound to the intended user", () => {
  assert.equal(verifyAdaptiveConfirmation(token(), "user-2", now), null);
  assert.equal(verifyAdaptiveConfirmation(token(), "user-1", now)?.proposalId, "proposal-1");
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
