import assert from "node:assert/strict";
import test from "node:test";
import { validateOperationsEvidence } from "../scripts/validate-operations-evidence";

const valid = {
  schemaVersion: 1,
  candidate: {
    commitSha: "1234567890abcdef1234567890abcdef12345678",
    imageDigest: `sha256:${"a".repeat(64)}`,
    migrationHead: "20260903200000_add_adaptive_planning_state",
  },
  runtime: {
    readinessCheckedAt: "2026-09-04T03:00:00.000Z",
    backupCreatedAt: "2026-09-04T03:01:00.000Z",
    restoreDrillCompletedAt: "2026-09-04T03:05:00.000Z",
    restoreElapsedSeconds: 240,
    rollbackRehearsedAt: "2026-09-04T03:10:00.000Z",
  },
  verifiedSignals: {
    databaseAndUploadsRestored: true,
    backupFailureAlertDelivered: true,
    unhealthyInstanceAlertDelivered: true,
    errorRateAlertDelivered: true,
    diskAlertDelivered: true,
    rollbackReturnedToHealthyReadiness: true,
  },
  privacy: {
    containsCredentials: false,
    containsCustomerContent: false,
    containsCustomerIdentifiers: false,
  },
};

test("exact-artifact operations evidence validates only after every runtime gate passes", () => {
  const result = validateOperationsEvidence(valid);
  assert.equal(result.evidenceValid, true);
  assert.equal(result.exactArtifactBound, true);
  assert.equal(result.alertClassesVerified, 4);
  assert.equal(result.rollbackVerified, true);
  assert.equal(result.restoreVerified, true);
  assert.equal(result.privacySafe, true);
});

test("placeholder artifact identities and missing alert evidence fail closed", () => {
  assert.throws(
    () => validateOperationsEvidence({ ...valid, candidate: { ...valid.candidate, commitSha: "0".repeat(40) } }),
    /non-placeholder/,
  );
  assert.throws(
    () => validateOperationsEvidence({
      ...valid,
      verifiedSignals: { ...valid.verifiedSignals, diskAlertDelivered: false },
    }),
    /diskAlertDelivered must be true/,
  );
});

test("operations evidence rejects customer data and credentials", () => {
  assert.throws(
    () => validateOperationsEvidence({
      ...valid,
      privacy: { ...valid.privacy, containsCustomerContent: true },
    }),
    /exclude credentials and customer data/,
  );
});
