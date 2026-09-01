import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pilot = readFileSync("PILOT.md", "utf8");

test("pilot validation is measurable, consent-first, and approval-gated", () => {
  assert.match(pilot, /five target users over 14 days/i);
  assert.match(pilot, /Product\s+measurement is optional and off by default/);
  assert.match(pilot, /first daily plan is created within ten minutes/);
  assert.match(pilot, /4 of 5 create first daily plan in under 10 minutes/);
  assert.match(pilot, /4 of 5 resolve a daily plan on at least 8 of 14 days/);
  assert.match(pilot, /at least 75%\s+contribution margin/);
  assert.match(pilot, /not\s+authorization to recruit, contact, enroll, charge, deploy, or publish pricing/i);
  assert.match(pilot, /separate approval decisions/);
});

test("pilot protocol protects private content and defines severe stop conditions", () => {
  assert.match(pilot, /Never copy task, goal, journal, chat, credential, file\s+content/);
  assert.match(pilot, /pause enrollment/);
  assert.match(pilot, /Never\s+average away a critical privacy, security, deletion, or data-loss failure/);
  assert.match(pilot, /Offer every participant an export and deletion path/);
});
