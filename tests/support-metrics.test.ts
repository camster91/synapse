import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSupportScorecard,
  parseSupportLedger,
  SUPPORT_LOAD_THRESHOLD_MINUTES,
} from "../scripts/support-metrics";

const fiveParticipants = ["P01", "P02", "P03", "P04", "P05"];
const completedWeekAsOf = new Date("2026-09-14T00:00:00.000Z");

function ledger(records: unknown[] = []) {
  return {
    schemaVersion: 1,
    participants: fiveParticipants,
    weeks: ["2026-09-07"],
    records,
  };
}

test("support scorecard includes zero-support account weeks in the median", () => {
  const parsed = parseSupportLedger(ledger([
    {
      participantId: "P01",
      weekKey: "2026-09-07",
      category: "access",
      severity: "sev2",
      firstResponseMinutes: 30,
      resolutionMinutes: 45,
      operatorMinutes: 20,
      blockedDailyLoop: true,
      resolved: true,
    },
  ]));
  const scorecard = buildSupportScorecard(parsed, completedWeekAsOf);

  assert.equal(SUPPORT_LOAD_THRESHOLD_MINUTES, 15);
  assert.equal(scorecard.participantCount, 5);
  assert.equal(scorecard.completedWeekCount, 1);
  assert.equal(scorecard.incompleteWeekCount, 0);
  assert.equal(scorecard.decisionEligible, true);
  assert.equal(scorecard.supportLoad.medianOperatorMinutesPerActiveAccountWeek, 0);
  assert.equal(scorecard.supportLoad.passes, true);
  assert.equal(scorecard.totalOperatorMinutes, 20);
});

test("scorecard is decision-ineligible with fewer than five pilot participant IDs", () => {
  const parsed = parseSupportLedger({
    schemaVersion: 1,
    participants: ["P01", "P02"],
    weeks: ["2026-09-07"],
    records: [],
  });
  const scorecard = buildSupportScorecard(parsed, completedWeekAsOf);
  assert.equal(scorecard.decisionEligible, false);
  assert.equal(scorecard.decisionIneligibleReason, "requires all five pilot participant IDs");
  assert.equal(scorecard.supportLoad.passes, null);
});

test("future or in-progress weeks cannot produce a passing support scorecard", () => {
  const parsed = parseSupportLedger(ledger());
  const scorecard = buildSupportScorecard(
    parsed,
    new Date("2026-09-13T23:59:59.999Z"),
  );

  assert.equal(scorecard.completedWeekCount, 0);
  assert.equal(scorecard.incompleteWeekCount, 1);
  assert.deepEqual(scorecard.incompleteWeekKeys, ["2026-09-07"]);
  assert.equal(scorecard.decisionEligible, false);
  assert.equal(scorecard.decisionIneligibleReason, "all listed support weeks must be complete");
  assert.equal(scorecard.supportLoad.passes, null);
});

test("any sev1 incident pauses enrolment regardless of aggregate support load", () => {
  const parsed = parseSupportLedger(ledger([
    {
      participantId: "P03",
      weekKey: "2026-09-07",
      category: "privacy",
      severity: "sev1",
      firstResponseMinutes: 1,
      resolutionMinutes: null,
      operatorMinutes: 2,
      blockedDailyLoop: true,
      resolved: false,
    },
  ]));
  const scorecard = buildSupportScorecard(parsed, completedWeekAsOf);
  assert.equal(scorecard.pauseEnrollment, true);
  assert.equal(scorecard.severityCounts.sev1, 1);
  assert.equal(scorecard.unresolvedIncidents, 1);
});

test("support ledger rejects free-text or identity fields instead of silently retaining them", () => {
  assert.throws(
    () => parseSupportLedger(ledger([
      {
        participantId: "P01",
        weekKey: "2026-09-07",
        category: "bug",
        severity: "sev3",
        firstResponseMinutes: 10,
        resolutionMinutes: 20,
        operatorMinutes: 5,
        blockedDailyLoop: false,
        resolved: true,
        email: "private@example.com",
      },
    ])),
    /record 1 contains unsupported fields/,
  );

  assert.throws(
    () => parseSupportLedger({ ...ledger(), participantName: "Private Name" }),
    /support ledger contains unsupported fields/,
  );
  // Unknown keys can themselves contain personal data; error text must redact them.
  assert.throws(
    () => parseSupportLedger({ ...ledger(), "private@example.com": "Private Name" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /support ledger contains unsupported fields/);
      assert.doesNotMatch(error.message, /private@example\.com|Private Name/);
      return true;
    },
  );
});

test("support ledger accepts only fixed participant identifiers and real calendar week keys", () => {
  assert.throws(
    () => parseSupportLedger({ ...ledger(), participants: ["P01", "Alice"] }),
    /participants is invalid/,
  );
  assert.throws(
    () => parseSupportLedger({ ...ledger(), participants: ["P01", "P01"] }),
    /participants must not contain duplicates/,
  );
  assert.throws(
    () => parseSupportLedger({ ...ledger(), weeks: ["2026-02-30"] }),
    /weeks is invalid/,
  );
  assert.throws(
    () => parseSupportLedger({ ...ledger(), weeks: ["2026-09-07", "2026-09-07"] }),
    /weeks must not contain duplicates/,
  );
  assert.throws(
    () => parseSupportLedger(ledger([
      {
        participantId: "P01",
        weekKey: "2026-09-14",
        category: "bug",
        severity: "sev3",
        firstResponseMinutes: 0,
        resolutionMinutes: 0,
        operatorMinutes: 0,
        blockedDailyLoop: false,
        resolved: true,
      },
    ])),
    /unknown weekKey/,
  );
});

test("support ledger rejects contradictory or impossible resolution timing", () => {
  const base = {
    participantId: "P01",
    weekKey: "2026-09-07",
    category: "bug",
    severity: "sev3",
    firstResponseMinutes: 10,
    operatorMinutes: 5,
    blockedDailyLoop: false,
  };

  assert.throws(
    () => parseSupportLedger(ledger([{ ...base, resolutionMinutes: null, resolved: true }])),
    /resolved incidents require resolutionMinutes/,
  );
  assert.throws(
    () => parseSupportLedger(ledger([{ ...base, resolutionMinutes: 20, resolved: false }])),
    /unresolved incidents require null resolutionMinutes/,
  );
  assert.throws(
    () => parseSupportLedger(ledger([{ ...base, resolutionMinutes: 5, resolved: true }])),
    /resolutionMinutes cannot precede first response/,
  );
});

test("invalid scorecard clocks fail closed", () => {
  const parsed = parseSupportLedger(ledger());
  assert.throws(
    () => buildSupportScorecard(parsed, new Date("invalid")),
    /scorecard time is invalid/,
  );
});
