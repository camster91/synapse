import { readFileSync } from "node:fs";

interface ReleasePackage {
  schemaVersion?: number;
  candidate?: { commitSha?: string; imageDigest?: string; migrationHead?: string };
  validation?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
  trust?: Record<string, unknown>;
  release?: Record<string, unknown>;
  approvalRequest?: {
    exactAction?: string;
    customerImpact?: string;
    costCad?: number;
    riskSummary?: string;
    rollbackSummary?: string;
    choices?: unknown;
  };
  approval?: {
    approved?: boolean;
    approvedArtifactCommitSha?: string;
    approvedArtifactImageDigest?: string;
  };
}

const REQUIRED_BOOLEAN_GROUPS = {
  validation: [
    "ciBuildPassed",
    "typecheckPassed",
    "lintPassed",
    "testsPassed",
    "dependencyAuditPassed",
    "secretScanPassed",
    "imageValidationPassed",
    "qualifiedReviewApproved",
    "requiredCheckGovernanceActive",
  ],
  runtime: [
    "composeDatabaseSmokePassed",
    "readinessPassed",
    "authenticatedLifecyclePassed",
    "backupRestorePassed",
    "rollbackPassed",
    "alertsPassed",
    "supportGatePassed",
  ],
  trust: [
    "externalEmailPassed",
    "legalPolicyApproved",
    "consentAndDataLifecycleReconciled",
    "accessibilityPassed",
    "performancePassed",
    "securityPrivacyReviewPassed",
  ],
  release: [
    "releaseNotesReady",
    "knownLimitationsReady",
    "rollbackTriggersReady",
    "responderApproved",
    "postReleaseVerificationReady",
    "stagedRolloutDefined",
  ],
} as const;

function exactSha(value: unknown, name: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/i.test(value) || /^0{40}$/.test(value)) {
    throw new Error(`${name} must be an exact non-placeholder 40-character SHA`);
  }
  return value.toLowerCase();
}

function exactDigest(value: unknown, name: string) {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/i.test(value) || /^sha256:0{64}$/.test(value)) {
    throw new Error(`${name} must be an exact non-placeholder sha256 digest`);
  }
  return value.toLowerCase();
}

function requiredText(value: unknown, name: string) {
  if (typeof value !== "string" || value.trim().length < 4 || /replace|tbd|todo|unknown/i.test(value)) {
    throw new Error(`${name} must be complete and non-placeholder`);
  }
  return value.trim();
}

export function validateReleasePackage(pkg: ReleasePackage, requireApproval = false) {
  if (pkg.schemaVersion !== 1) throw new Error("Unsupported RC1 release package schema");

  const commitSha = exactSha(pkg.candidate?.commitSha, "candidate.commitSha");
  const imageDigest = exactDigest(pkg.candidate?.imageDigest, "candidate.imageDigest");
  requiredText(pkg.candidate?.migrationHead, "candidate.migrationHead");

  for (const [group, keys] of Object.entries(REQUIRED_BOOLEAN_GROUPS)) {
    const record = pkg[group as keyof ReleasePackage] as Record<string, unknown> | undefined;
    for (const key of keys) {
      if (record?.[key] !== true) throw new Error(`${group}.${key} must be true`);
    }
  }

  requiredText(pkg.approvalRequest?.exactAction, "approvalRequest.exactAction");
  requiredText(pkg.approvalRequest?.customerImpact, "approvalRequest.customerImpact");
  requiredText(pkg.approvalRequest?.riskSummary, "approvalRequest.riskSummary");
  requiredText(pkg.approvalRequest?.rollbackSummary, "approvalRequest.rollbackSummary");

  const cost = pkg.approvalRequest?.costCad;
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0) {
    throw new Error("approvalRequest.costCad must be an explicit non-negative CAD amount");
  }

  const choices = pkg.approvalRequest?.choices;
  if (
    !Array.isArray(choices) ||
    JSON.stringify(choices) !== JSON.stringify(["approve", "reject", "request-changes"])
  ) {
    throw new Error("approvalRequest.choices must be approve/reject/request-changes");
  }

  if (requireApproval) {
    if (pkg.approval?.approved !== true) throw new Error("approval.approved must be explicitly true");
    const approvedSha = exactSha(pkg.approval?.approvedArtifactCommitSha, "approval.approvedArtifactCommitSha");
    const approvedDigest = exactDigest(pkg.approval?.approvedArtifactImageDigest, "approval.approvedArtifactImageDigest");
    if (approvedSha !== commitSha || approvedDigest !== imageDigest) {
      throw new Error("approval must bind to the exact candidate commit SHA and image digest");
    }
  }

  return {
    packageReady: true,
    exactArtifactBound: true,
    approvedForMutation: requireApproval,
    gateCount: Object.values(REQUIRED_BOOLEAN_GROUPS).reduce((sum, keys) => sum + keys.length, 0),
  };
}

if (process.argv[1]?.endsWith("validate-release-package.ts")) {
  const path = process.argv[2];
  const requireApproval = process.argv.includes("--require-approval");
  if (!path || path === "--require-approval") {
    console.error("usage: npm run release:validate -- <release-package.json> [--require-approval]");
    process.exitCode = 2;
  } else {
    try {
      const pkg = JSON.parse(readFileSync(path, "utf8")) as ReleasePackage;
      console.log(JSON.stringify(validateReleasePackage(pkg, requireApproval), null, 2));
    } catch (error) {
      console.error(`[release-package] ${error instanceof Error ? error.message : "failed"}`);
      process.exitCode = 1;
    }
  }
}
