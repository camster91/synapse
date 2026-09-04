import { readFileSync } from "node:fs";

interface Evidence {
  schemaVersion?: number;
  candidate?: {
    commitSha?: string;
    imageDigest?: string;
    migrationHead?: string;
  };
  runtime?: {
    readinessCheckedAt?: string;
    backupCreatedAt?: string;
    restoreDrillCompletedAt?: string;
    restoreElapsedSeconds?: number;
    rollbackRehearsedAt?: string;
  };
  verifiedSignals?: Record<string, unknown>;
  privacy?: {
    containsCredentials?: boolean;
    containsCustomerContent?: boolean;
    containsCustomerIdentifiers?: boolean;
  };
}

const REQUIRED_SIGNALS = [
  "databaseAndUploadsRestored",
  "backupFailureAlertDelivered",
  "unhealthyInstanceAlertDelivered",
  "errorRateAlertDelivered",
  "diskAlertDelivered",
  "rollbackReturnedToHealthyReadiness",
] as const;

function realTimestamp(value: unknown, name: string) {
  if (typeof value !== "string") throw new Error(`${name} is required`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() < 2025) {
    throw new Error(`${name} must be a real ISO timestamp`);
  }
  return parsed;
}

export function validateOperationsEvidence(evidence: Evidence) {
  if (evidence.schemaVersion !== 1) throw new Error("Unsupported operations evidence schema");

  const sha = evidence.candidate?.commitSha ?? "";
  if (!/^[0-9a-f]{40}$/i.test(sha) || /^0{40}$/.test(sha)) {
    throw new Error("candidate.commitSha must be an exact non-placeholder 40-character SHA");
  }

  const digest = evidence.candidate?.imageDigest ?? "";
  if (!/^sha256:[0-9a-f]{64}$/i.test(digest) || /^sha256:0{64}$/.test(digest)) {
    throw new Error("candidate.imageDigest must be an exact non-placeholder sha256 digest");
  }

  const migrationHead = evidence.candidate?.migrationHead?.trim() ?? "";
  if (!migrationHead || /replace|tbd|todo|unknown/i.test(migrationHead)) {
    throw new Error("candidate.migrationHead must identify the exact migration boundary");
  }

  realTimestamp(evidence.runtime?.readinessCheckedAt, "runtime.readinessCheckedAt");
  realTimestamp(evidence.runtime?.backupCreatedAt, "runtime.backupCreatedAt");
  realTimestamp(evidence.runtime?.restoreDrillCompletedAt, "runtime.restoreDrillCompletedAt");
  realTimestamp(evidence.runtime?.rollbackRehearsedAt, "runtime.rollbackRehearsedAt");

  const elapsed = evidence.runtime?.restoreElapsedSeconds;
  if (
    typeof elapsed !== "number" ||
    !Number.isFinite(elapsed) ||
    !Number.isInteger(elapsed) ||
    elapsed <= 0
  ) {
    throw new Error("runtime.restoreElapsedSeconds must be a positive integer");
  }

  for (const signal of REQUIRED_SIGNALS) {
    if (evidence.verifiedSignals?.[signal] !== true) {
      throw new Error(`verifiedSignals.${signal} must be true`);
    }
  }

  if (
    evidence.privacy?.containsCredentials !== false ||
    evidence.privacy?.containsCustomerContent !== false ||
    evidence.privacy?.containsCustomerIdentifiers !== false
  ) {
    throw new Error("operations evidence must explicitly exclude credentials and customer data");
  }

  return {
    evidenceValid: true,
    exactArtifactBound: true,
    alertClassesVerified: REQUIRED_SIGNALS.filter((name) => name.endsWith("AlertDelivered")).length,
    rollbackVerified: true,
    restoreVerified: true,
    privacySafe: true,
  };
}

if (process.argv[1]?.endsWith("validate-operations-evidence.ts")) {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: npm run ops:evidence -- <operations-evidence.json>");
    process.exitCode = 2;
  } else {
    try {
      const evidence = JSON.parse(readFileSync(path, "utf8")) as Evidence;
      console.log(JSON.stringify(validateOperationsEvidence(evidence), null, 2));
    } catch (error) {
      console.error(`[operations-evidence] ${error instanceof Error ? error.message : "failed"}`);
      process.exitCode = 1;
    }
  }
}
