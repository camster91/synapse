const REQUIRED_IDENTIFIERS = [
  "SYNAPSE_BACKUP_DESTINATION_ID",
  "SYNAPSE_ALERT_DESTINATION_ID",
  "SYNAPSE_RESPONDER_ID",
] as const;

const REQUIRED_ATTESTATIONS = [
  "SYNAPSE_BACKUP_OFFSITE_CONFIRMED",
  "SYNAPSE_BACKUP_ENCRYPTION_CONFIRMED",
] as const;

const PLACEHOLDER = /(?:^|[-_\s])(tbd|todo|unset|unknown|unapproved|example|sample|test|replace(?:-me)?|change(?:-me)?|none)(?:$|[-_\s])/i;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,119}$/;
const RESERVED_HOST_SUFFIXES = [".example", ".invalid", ".localhost", ".test"];

const POSITIVE_INTEGER_LIMITS = {
  SYNAPSE_BACKUP_RETENTION_DAYS: { min: 1, max: 3650 },
  SYNAPSE_RPO_MINUTES: { min: 1, max: 10_080 },
  SYNAPSE_RTO_MINUTES: { min: 1, max: 10_080 },
} as const;

type PositiveIntegerName = keyof typeof POSITIVE_INTEGER_LIMITS;

function identifierValue(name: (typeof REQUIRED_IDENTIFIERS)[number]) {
  const value = process.env[name]?.trim() ?? "";
  if (!value || PLACEHOLDER.test(value)) {
    throw new Error(`${name} is not approved/configured`);
  }
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${name} must be a 3-120 character opaque identifier`);
  }
  return value;
}

function boundedPositiveInteger(name: PositiveIntegerName) {
  const raw = process.env[name]?.trim() ?? "";
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} must be a positive integer`);
  }

  const value = Number(raw);
  const limits = POSITIVE_INTEGER_LIMITS[name];
  if (
    !Number.isSafeInteger(value) ||
    value < limits.min ||
    value > limits.max
  ) {
    throw new Error(`${name} is outside the supported operating range`);
  }
  return value;
}

function confirmed(name: (typeof REQUIRED_ATTESTATIONS)[number]) {
  if (process.env[name]?.trim().toLowerCase() !== "true") {
    throw new Error(`${name} must be explicitly true`);
  }
}

function validateHost() {
  const value = process.env.SYNAPSE_MANAGED_HOST_URL?.trim() ?? "";
  if (!value || PLACEHOLDER.test(value)) {
    throw new Error("SYNAPSE_MANAGED_HOST_URL is not approved/configured");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SYNAPSE_MANAGED_HOST_URL must be an absolute HTTPS origin");
  }

  const hostname = url.hostname.toLowerCase();
  const reservedHost =
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname) ||
    RESERVED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    reservedHost
  ) {
    throw new Error(
      "SYNAPSE_MANAGED_HOST_URL must be an approved HTTPS origin without credentials, path, query, fragment, or reserved hostname",
    );
  }
}

export function buildOperationsPreflight() {
  validateHost();

  for (const name of REQUIRED_IDENTIFIERS) identifierValue(name);
  for (const name of REQUIRED_ATTESTATIONS) confirmed(name);

  const retentionDays = boundedPositiveInteger("SYNAPSE_BACKUP_RETENTION_DAYS");
  const rpoMinutes = boundedPositiveInteger("SYNAPSE_RPO_MINUTES");
  const rtoMinutes = boundedPositiveInteger("SYNAPSE_RTO_MINUTES");

  if (rpoMinutes > retentionDays * 24 * 60) {
    throw new Error("SYNAPSE_RPO_MINUTES cannot exceed the approved retention window");
  }

  return {
    schemaVersion: 1,
    decisionReady: true,
    configured: {
      managedHost: true,
      backupDestination: true,
      alertDestination: true,
      responder: true,
      offsiteBackup: true,
      encryptedBackup: true,
    },
    objectives: {
      retentionDays,
      rpoMinutes,
      rtoMinutes,
    },
    operationalEvidenceVerified: false,
    note: "Approved decision inputs are present; runtime backup, alert, restore, and rollback evidence is still required.",
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
