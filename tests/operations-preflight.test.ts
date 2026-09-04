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
  SYNAPSE_MANAGED_HOST_URL: "https://synapse.example.test",
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

test("operations preflight rejects unsafe or placeholder host decisions", () => {
  withEnv({ ...valid, SYNAPSE_MANAGED_HOST_URL: "http://example.test" }, () => {
    assert.throws(() => buildOperationsPreflight(), /HTTPS URL/);
  });
  withEnv({ ...valid, SYNAPSE_RESPONDER_ID: "TBD" }, () => {
    assert.throws(() => buildOperationsPreflight(), /not approved\/configured/);
  });
});

test("operations preflight reports only non-sensitive readiness aggregates", () => {
  withEnv(valid, () => {
    const result = buildOperationsPreflight();
    assert.equal(result.decisionReady, true);
    assert.equal(result.operationalEvidenceVerified, false);
    assert.equal(result.retentionDays, 30);
    assert.equal(result.rpoMinutes, 1440);
    assert.equal(result.rtoMinutes, 240);

    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /synapse\.example\.test/);
    assert.doesNotMatch(serialized, /encrypted-offsite-primary/);
    assert.doesNotMatch(serialized, /managed-beta-alert-route/);
    assert.doesNotMatch(serialized, /primary-operator/);
  });
});
