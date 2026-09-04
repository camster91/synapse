import { readFile } from "node:fs/promises";

export const SUPPORT_LOAD_THRESHOLD_MINUTES = 15;

const PARTICIPANT_PATTERN = /^P0[1-5]$/;
const WEEK_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SUPPORT_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CATEGORIES = [
  "access",
  "reliability",
  "data-control",
  "privacy",
  "bug",
  "usability",
  "other",
] as const;
const SEVERITIES = ["sev1", "sev2", "sev3"] as const;

type Category = (typeof CATEGORIES)[number];
type Severity = (typeof SEVERITIES)[number];

export interface SupportRecord {
  participantId: string;
  weekKey: string;
  category: Category;
  severity: Severity;
  firstResponseMinutes: number;
  resolutionMinutes: number | null;
  operatorMinutes: number;
  blockedDailyLoop: boolean;
  resolved: boolean;
}

export interface SupportLedger {
  schemaVersion: 1;
  participants: string[];
  weeks: string[];
  records: SupportRecord[];
}

const LEDGER_KEYS = new Set(["schemaVersion", "participants", "weeks", "records"]);
const RECORD_KEYS = new Set([
  "participantId",
  "weekKey",
  "category",
  "severity",
  "firstResponseMinutes",
  "resolutionMinutes",
  "operatorMinutes",
  "blockedDailyLoop",
  "resolved",
]);

function assertPlainObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: Set<string>, label: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} contains unsupported field: ${key}`);
    }
  }
}

function nonNegativeNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return value;
}

function nullableNonNegativeNumber(value: unknown, label: string) {
  if (value === null) return null;
  return nonNegativeNumber(value, label);
}

function uniqueParticipantIds(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || !PARTICIPANT_PATTERN.test(item))
  ) {
    throw new Error("participants is invalid");
  }
  if (new Set(value).size !== value.length) {
    throw new Error("participants must not contain duplicates");
  }
  return [...value] as string[];
}

function isValidIsoDate(value: string) {
  if (!WEEK_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function uniqueWeekKeys(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !isValidIsoDate(item))) {
    throw new Error("weeks is invalid");
  }
  if (new Set(value).size !== value.length) {
    throw new Error("weeks must not contain duplicates");
  }
  return [...value] as string[];
}

export function parseSupportLedger(value: unknown): SupportLedger {
  assertPlainObject(value, "support ledger");
  rejectUnknownKeys(value, LEDGER_KEYS, "support ledger");

  if (value.schemaVersion !== 1) throw new Error("unsupported support ledger schema version");
  const participants = uniqueParticipantIds(value.participants);
  const weeks = uniqueWeekKeys(value.weeks);
  if (!Array.isArray(value.records)) throw new Error("records must be an array");

  const participantSet = new Set(participants);
  const weekSet = new Set(weeks);
  const records = value.records.map((raw, index): SupportRecord => {
    assertPlainObject(raw, `record ${index + 1}`);
    rejectUnknownKeys(raw, RECORD_KEYS, `record ${index + 1}`);

    if (typeof raw.participantId !== "string" || !participantSet.has(raw.participantId)) {
      throw new Error(`record ${index + 1} has an unknown participantId`);
    }
    if (typeof raw.weekKey !== "string" || !weekSet.has(raw.weekKey)) {
      throw new Error(`record ${index + 1} has an unknown weekKey`);
    }
    if (typeof raw.category !== "string" || !CATEGORIES.includes(raw.category as Category)) {
      throw new Error(`record ${index + 1} has an invalid category`);
    }
    if (typeof raw.severity !== "string" || !SEVERITIES.includes(raw.severity as Severity)) {
      throw new Error(`record ${index + 1} has an invalid severity`);
    }
    if (typeof raw.blockedDailyLoop !== "boolean" || typeof raw.resolved !== "boolean") {
      throw new Error(`record ${index + 1} has invalid boolean fields`);
    }

    const firstResponseMinutes = nonNegativeNumber(
      raw.firstResponseMinutes,
      `record ${index + 1} firstResponseMinutes`,
    );
    const resolutionMinutes = nullableNonNegativeNumber(
      raw.resolutionMinutes,
      `record ${index + 1} resolutionMinutes`,
    );

    if (raw.resolved && resolutionMinutes === null) {
      throw new Error(`record ${index + 1} resolved incidents require resolutionMinutes`);
    }
    if (!raw.resolved && resolutionMinutes !== null) {
      throw new Error(`record ${index + 1} unresolved incidents require null resolutionMinutes`);
    }
    if (resolutionMinutes !== null && resolutionMinutes < firstResponseMinutes) {
      throw new Error(`record ${index + 1} resolutionMinutes cannot precede first response`);
    }

    return {
      participantId: raw.participantId,
      weekKey: raw.weekKey,
      category: raw.category as Category,
      severity: raw.severity as Severity,
      firstResponseMinutes,
      resolutionMinutes,
      operatorMinutes: nonNegativeNumber(
        raw.operatorMinutes,
        `record ${index + 1} operatorMinutes`,
      ),
      blockedDailyLoop: raw.blockedDailyLoop,
      resolved: raw.resolved,
    };
  });

  return { schemaVersion: 1, participants, weeks, records };
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function rounded(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function supportWeekEnd(weekKey: string) {
  return new Date(new Date(`${weekKey}T00:00:00.000Z`).getTime() + SUPPORT_WEEK_MS);
}

function ineligibleReason(input: {
  participantCount: number;
  weekCount: number;
  incompleteWeekCount: number;
}) {
  if (input.participantCount !== 5) return "requires all five pilot participant IDs";
  if (input.weekCount === 0) return "requires at least one measured week";
  if (input.incompleteWeekCount > 0) return "all listed support weeks must be complete";
  return null;
}

export function buildSupportScorecard(ledger: SupportLedger, now = new Date()) {
  if (Number.isNaN(now.getTime())) throw new Error("scorecard time is invalid");

  const participantWeekMinutes = new Map<string, number>();
  for (const participant of ledger.participants) {
    for (const week of ledger.weeks) participantWeekMinutes.set(`${participant}:${week}`, 0);
  }

  const categoryCounts = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<Category, number>;
  const severityCounts = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0])) as Record<Severity, number>;

  for (const record of ledger.records) {
    const key = `${record.participantId}:${record.weekKey}`;
    participantWeekMinutes.set(key, (participantWeekMinutes.get(key) ?? 0) + record.operatorMinutes);
    categoryCounts[record.category] += 1;
    severityCounts[record.severity] += 1;
  }

  const firstResponseMinutes = ledger.records.map((record) => record.firstResponseMinutes);
  const resolutionMinutes = ledger.records.flatMap((record) =>
    record.resolutionMinutes === null ? [] : [record.resolutionMinutes]
  );
  const weeklyAccountMinutes = [...participantWeekMinutes.values()];
  const medianOperatorMinutes = rounded(median(weeklyAccountMinutes));
  const incompleteWeekKeys = ledger.weeks.filter(
    (weekKey) => supportWeekEnd(weekKey).getTime() > now.getTime(),
  );
  const decisionIneligibleReason = ineligibleReason({
    participantCount: ledger.participants.length,
    weekCount: ledger.weeks.length,
    incompleteWeekCount: incompleteWeekKeys.length,
  });
  const decisionEligible = decisionIneligibleReason === null;

  return {
    schemaVersion: 1,
    privacyBoundary: "aggregate-support-metrics-only",
    measurementAsOf: now.toISOString(),
    participantCount: ledger.participants.length,
    weekCount: ledger.weeks.length,
    completedWeekCount: ledger.weeks.length - incompleteWeekKeys.length,
    incompleteWeekCount: incompleteWeekKeys.length,
    incompleteWeekKeys,
    incidentCount: ledger.records.length,
    decisionEligible,
    decisionIneligibleReason,
    supportLoad: {
      thresholdOperatorMinutesPerActiveAccountWeek: SUPPORT_LOAD_THRESHOLD_MINUTES,
      medianOperatorMinutesPerActiveAccountWeek: medianOperatorMinutes,
      passes: decisionEligible && medianOperatorMinutes !== null
        ? medianOperatorMinutes <= SUPPORT_LOAD_THRESHOLD_MINUTES
        : null,
    },
    totalOperatorMinutes: rounded(ledger.records.reduce((sum, record) => sum + record.operatorMinutes, 0)),
    medianFirstResponseMinutes: rounded(median(firstResponseMinutes)),
    medianResolutionMinutes: rounded(median(resolutionMinutes)),
    blockedDailyLoopIncidents: ledger.records.filter((record) => record.blockedDailyLoop).length,
    unresolvedIncidents: ledger.records.filter((record) => !record.resolved).length,
    severityCounts,
    categoryCounts,
    pauseEnrollment: severityCounts.sev1 > 0,
  };
}

async function main() {
  const inputPath = process.argv[2] || process.env.SUPPORT_METRICS_INPUT;
  if (!inputPath) {
    throw new Error("provide a privacy-minimal support ledger path as the first argument or SUPPORT_METRICS_INPUT");
  }

  const raw = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  const scorecard = buildSupportScorecard(parseSupportLedger(raw));
  process.stdout.write(`${JSON.stringify(scorecard, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("support-metrics.ts")) {
  main().catch((error) => {
    console.error(`[support-metrics] ${error instanceof Error ? error.message : "failed"}`);
    process.exitCode = 1;
  });
}
