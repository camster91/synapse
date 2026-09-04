const REQUIRED_TEXT = [
  "SYNAPSE_MANAGED_HOST_URL",
  "SYNAPSE_BACKUP_DESTINATION_ID",
  "SYNAPSE_ALERT_DESTINATION_ID",
  "SYNAPSE_RESPONDER_ID",
] as const;

const REQUIRED_POSITIVE_INTEGERS = [
  "SYNAPSE_BACKUP_RETENTION_DAYS",
  "SYNAPSE_RPO_MINUTES",
  "SYNAPSE_RTO_MINUTES",
] as const;

const REQUIRED_ATTESTATIONS = [
  "SYNAPSE_BACKUP_OFFSITE_CONFIRMED",
  "SYNAPSE_BACKUP_ENCRYPTION_CONFIRMED",
] as const;

const PLACEHOLDER = /(?:^|[-_\s])(tbd|todo|unset|unknown|unapproved|replace(?:-me)?)(?:$|[-_\s])/i;

function textValue(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!value || PLACEHOLDER.test(value)) throw new Error(`${name} is not approved/configured`);
  return value;
}

function positiveInteger(name: string) {
  const raw = process.env[name]?.trim() ?? "";
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function confirmed(name: string) {
  if (process.env[name]?.trim().toLowerCase() !== "true") {
    throw new Error(`${name} must be explicitly true`);
  }
  return true;
}

function validateHost(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SYNAPSE_MANAGED_HOST_URL must be an absolute HTTPS URL");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("SYNAPSE_MANAGED_HOST_URL must be an absolute HTTPS URL without embedded credentials");
  }
}

export function buildOperationsPreflight() {
  const text = Object.fromEntries(REQUIRED_TEXT.map((name) => [name, textValue(name)]));
  validateHost(text.SYNAPSE_MANAGED_HOST_URL);

  const numbers = Object.fromEntries(
    REQUIRED_POSITIVE_INTEGERS.map((name) => [name, positiveInteger(name)]),
  );
  for (const name of REQUIRED_ATTESTATIONS) confirmed(name);

  return {
    decisionReady: true,
    configured: {
      managedHost: true,
      backupDestination: true,
      alertDestination: true,
      responder: true,
      offsiteBackup: true,
      encryptedBackup: true,
    },
    retentionDays: numbers.SYNAPSE_BACKUP_RETENTION_DAYS,
    rpoMinutes: numbers.SYNAPSE_RPO_MINUTES,
    rtoMinutes: numbers.SYNAPSE_RTO_MINUTES,
    operationalEvidenceVerified: false,
    note: "Configuration decisions are present; runtime backup, alert, restore, and rollback evidence is still required.",
  };
}

if (process.argv[1]?.endsWith("operations-preflight.ts")) {
  try {
    console.log(JSON.stringify(buildOperationsPreflight(), null, 2));
  } catch (error) {
    console.error(`[operations-preflight] ${error instanceof Error ? error.message : "failed"}`);
    process.exitCode = 1;
  }
}
