import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSupportScorecard,
  parseSupportLedger,
  SUPPORT_LOAD_THRESHOLD_MINUTES,
} from "../scripts/support-metrics";

const fiveParticipants = ["P01", "P02", "P03", "P04", "P05"];

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
  const scorecard = buildSupportScorecard(parsed);

  assert.equal(SUPPORT_LOAD_THRESHOLD_MINUTES, 15);
  assert.equal(scorecard.participantCount, 5);
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
  const scorecard = buildSupportScorecard(parsed);
  assert.equal(scorecard.decisionEligible, false);
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
  const scorecard = buildSupportScorecard(parsed);
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
    /unsupported field: email/,
  );

  assert.throws(
    () => parseSupportLedger({ ...ledger(), participantName: "Private Name" }),
    /unsupported field: participantName/,
  );
});

test("support ledger only accepts fixed pilot participant identifiers and known weeks", () => {
  assert.throws(
    () => parseSupportLedger({ ...ledger(), participants: ["P01", "Alice"] }),
    /participants is invalid/,
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
