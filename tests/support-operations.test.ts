import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const support = readFileSync("SUPPORT.md", "utf8");
const metrics = readFileSync("scripts/support-metrics.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("support operations leave externally meaningful routes and promises approval-gated", () => {
  assert.match(support, /Primary support route: \*\*OWNER DECISION REQUIRED\*\*/);
  assert.match(support, /Urgent access\/data-loss\/deletion\/privacy route: \*\*OWNER DECISION REQUIRED\*\*/);
  assert.match(support, /Response hours\/time zone: \*\*OWNER DECISION REQUIRED\*\*/);
  assert.match(support, /No response-time or resolution-time SLA is promised/);
  assert.match(support, /Do not send or publish this wording until/);
});

test("sev1 stop rules cover the beta trust failures from issue 63", () => {
  for (const phrase of [
    "cross-account access",
    "credential, secret, or authentication-token exposure",
    "unrecoverable user-data loss",
    "account deletion that reports success but fails",
    "privacy incident",
  ]) {
    assert.match(support, new RegExp(phrase));
  }
  assert.match(support, /stop new enrolment/);
  assert.match(metrics, /pauseEnrollment: severityCounts\.sev1 > 0/);
});

test("support scorecard is a first-class package command with no free-text schema", () => {
  assert.equal(packageJson.scripts["metrics:support"], "tsx scripts/support-metrics.ts");
  assert.match(metrics, /aggregate-support-metrics-only/);
  assert.match(metrics, /unsupported field/);
  assert.doesNotMatch(metrics, /description|messageBody|notes|emailAddress|participantName/);
});
