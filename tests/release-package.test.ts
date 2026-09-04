import assert from "node:assert/strict";
import test from "node:test";
import { validateReleasePackage } from "../scripts/validate-release-package";

const allTrue = {
  validation: {
    ciBuildPassed: true,
    typecheckPassed: true,
    lintPassed: true,
    testsPassed: true,
    dependencyAuditPassed: true,
    secretScanPassed: true,
    imageValidationPassed: true,
    qualifiedReviewApproved: true,
    requiredCheckGovernanceActive: true,
  },
  runtime: {
    composeDatabaseSmokePassed: true,
    readinessPassed: true,
    authenticatedLifecyclePassed: true,
    backupRestorePassed: true,
    rollbackPassed: true,
    alertsPassed: true,
    supportGatePassed: true,
  },
  trust: {
    externalEmailPassed: true,
    legalPolicyApproved: true,
    consentAndDataLifecycleReconciled: true,
    accessibilityPassed: true,
    performancePassed: true,
    securityPrivacyReviewPassed: true,
  },
  release: {
    releaseNotesReady: true,
    knownLimitationsReady: true,
    rollbackTriggersReady: true,
    responderApproved: true,
    postReleaseVerificationReady: true,
    stagedRolloutDefined: true,
  },
};

const valid = {
  schemaVersion: 1,
  candidate: {
    commitSha: "1234567890abcdef1234567890abcdef12345678",
    imageDigest: `sha256:${"a".repeat(64)}`,
    migrationHead: "20260903200000_add_adaptive_planning_state",
  },
  ...allTrue,
  approvalRequest: {
    exactAction: "Deploy the exact RC1 image to the approved managed-beta host for five invited testers.",
    customerImpact: "Five invited testers can access the private beta; no public launch or billing.",
    costCad: 0,
    riskSummary: "Candidate may require rollback if readiness, auth, deletion, or data-isolation signals regress.",
    rollbackSummary: "Restore the previously approved immutable image and verify readiness before reopening access.",
    choices: ["approve", "reject", "request-changes"],
  },
  approval: {
    approved: false,
    approvedArtifactCommitSha: "",
    approvedArtifactImageDigest: "",
  },
};

test("a fully evidenced package can be review-ready without authorizing mutation", () => {
  const result = validateReleasePackage(valid, false);
  assert.equal(result.packageReady, true);
  assert.equal(result.exactArtifactBound, true);
  assert.equal(result.approvedForMutation, false);
  assert.equal(result.gateCount, 28);
});

test("deployment approval must bind to the exact candidate artifact", () => {
  assert.throws(() => validateReleasePackage(valid, true), /approved must be explicitly true/);

  const approved = {
    ...valid,
    approval: {
      approved: true,
      approvedArtifactCommitSha: valid.candidate.commitSha,
      approvedArtifactImageDigest: valid.candidate.imageDigest,
    },
  };
  assert.equal(validateReleasePackage(approved, true).approvedForMutation, true);

  assert.throws(
    () => validateReleasePackage({
      ...approved,
      approval: { ...approved.approval, approvedArtifactCommitSha: "f".repeat(40) },
    }, true),
    /approval must bind to the exact candidate/,
  );
});

test("missing gates and placeholder artifact identities fail closed", () => {
  assert.throws(
    () => validateReleasePackage({
      ...valid,
      candidate: { ...valid.candidate, commitSha: "0".repeat(40) },
    }),
    /non-placeholder/,
  );
  assert.throws(
    () => validateReleasePackage({
      ...valid,
      runtime: { ...valid.runtime, rollbackPassed: false },
    }),
    /runtime.rollbackPassed must be true/,
  );
});

test("approval request must state action, impact, cost, risk, rollback, and explicit choices", () => {
  assert.throws(
    () => validateReleasePackage({
      ...valid,
      approvalRequest: { ...valid.approvalRequest, exactAction: "" },
    }),
    /exactAction/,
  );
  assert.throws(
    () => validateReleasePackage({
      ...valid,
      approvalRequest: { ...valid.approvalRequest, choices: ["approve"] },
    }),
    /approve\/reject\/request-changes/,
  );
});
