import assert from "node:assert/strict";
import test from "node:test";
import { buildOperationsPreflight } from "../scripts/operations-preflight";

const KEYS = [
  "SYNAPSE_MANAGED_HOST_URL",
  "SYNAPSE_BACKUP_DESTINATION_ID",
  "SYNAPSE_BACKUP_OFFSITE_CONFIRMED",
  "SYNAPSE_BACKUP_ENCRYPTION_CONFIRMED",
  "SYNAPSE_ALERT_DESTINATION_ID",
  "SYNAPSE_RESPONDER_ID",
  "SYNAPSE_BACKUP_RETENTION_DAYS",
  "SYNAPSE_RPO_MINUTES",
  "SYNAPSE_RTO_MINUTES",
] as const;

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const prior = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of KEYS) {
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const key of KEYS) {
      const value = prior[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const valid = {
  SYNAPSE_MANAGED_HOST_URL: "https://beta.synapse.ashbi.ca",
  SYNAPSE_BACKUP_DESTINATION_ID: "encrypted-offsite-primary",
  SYNAPSE_BACKUP_OFFSITE_CONFIRMED: "true",
  SYNAPSE_BACKUP_ENCRYPTION_CONFIRMED: "true",
  SYNAPSE_ALERT_DESTINATION_ID: "managed-beta-alert-route",
  SYNAPSE_RESPONDER_ID: "primary-operator",
  SYNAPSE_BACKUP_RETENTION_DAYS: "30",
  SYNAPSE_RPO_MINUTES: "1440",
  SYNAPSE_RTO_MINUTES: "240",
};

test("operations preflight fails closed on missing decisions or attestations", () => {
  withEnv({}, () => assert.throws(() => buildOperationsPreflight(), /not approved\/configured/));
  withEnv({ ...valid, SYNAPSE_BACKUP_ENCRYPTION_CONFIRMED: "false" }, () => {
    assert.throws(() => buildOperationsPreflight(), /must be explicitly true/);
  });
});

test("operations preflight accepts only an approved HTTPS origin", () => {
  for (const unsafeHost of [
    "http://beta.synapse.ashbi.ca",
    "https://user:secret@beta.synapse.ashbi.ca",
    "https://beta.synapse.ashbi.ca/path",
    "https://beta.synapse.ashbi.ca/?token=secret",
    "https://localhost",
    "https://beta.example.test",
  ]) {
    withEnv({ ...valid, SYNAPSE_MANAGED_HOST_URL: unsafeHost }, () => {
      assert.throws(() => buildOperationsPreflight(), /approved HTTPS origin|absolute HTTPS origin/);
    });
  }
});

test("operations preflight rejects placeholder or unsafe decision identifiers", () => {
  for (const responderId of ["TBD", "test-operator", "ab", "route?token=secret", "operator name"]) {
    withEnv({ ...valid, SYNAPSE_RESPONDER_ID: responderId }, () => {
      assert.throws(
        () => buildOperationsPreflight(),
        /not approved\/configured|opaque identifier/,
      );
    });
  }
});

test("operations preflight enforces bounded objectives and retention consistency", () => {
  withEnv({ ...valid, SYNAPSE_BACKUP_RETENTION_DAYS: "0" }, () => {
    assert.throws(() => buildOperationsPreflight(), /supported operating range/);
  });
  withEnv({ ...valid, SYNAPSE_RTO_MINUTES: "10081" }, () => {
    assert.throws(() => buildOperationsPreflight(), /supported operating range/);
  });
  withEnv({
    ...valid,
    SYNAPSE_BACKUP_RETENTION_DAYS: "1",
    SYNAPSE_RPO_MINUTES: "1441",
  }, () => {
    assert.throws(() => buildOperationsPreflight(), /cannot exceed the approved retention window/);
  });
});

test("operations preflight reports only non-sensitive readiness aggregates", () => {
  withEnv(valid, () => {
    const result = buildOperationsPreflight();
    assert.equal(result.decisionReady, true);
    assert.equal(result.operationalEvidenceVerified, false);
    assert.equal(result.objectives.retentionDays, 30);
    assert.equal(result.objectives.rpoMinutes, 1440);
    assert.equal(result.objectives.rtoMinutes, 240);
    assert.deepEqual(result.configured, {
      managedHost: true,
      backupDestination: true,
      alertDestination: true,
      responder: true,
      offsiteBackup: true,
      encryptedBackup: true,
    });

    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /beta\.synapse\.ashbi\.ca/);
    assert.doesNotMatch(serialized, /encrypted-offsite-primary/);
    assert.doesNotMatch(serialized, /managed-beta-alert-route/);
    assert.doesNotMatch(serialized, /primary-operator/);
  });
});
