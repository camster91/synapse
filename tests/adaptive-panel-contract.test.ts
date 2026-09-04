import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync("src/components/AdaptivePlanningPanel.tsx", "utf8");
const today = readFileSync("src/components/TodayPage.tsx", "utf8");
const route = readFileSync("src/app/(app)/today/page.tsx", "utf8");

test("Today exposes the complete My day changed flow", () => {
  assert.match(panel, /My day changed/);
  assert.match(panel, /\/api\/adaptive-planning\/preview/);
  assert.match(panel, /\/api\/adaptive-planning\/apply/);
  assert.match(panel, /\/api\/adaptive-planning\/undo/);
  assert.match(today, /AdaptivePlanningPanel/);
  assert.match(route, /TodayPage/);
});

test("the dialog is mobile first and keyboard accessible", () => {
  assert.match(panel, /role="dialog"/);
  assert.match(panel, /aria-modal="true"/);
  assert.match(panel, /event\.key === "Escape"/);
  assert.match(panel, /event\.key !== "Tab"/);
  assert.match(panel, /items-end/);
  assert.match(panel, /sm:items-center/);
  assert.match(panel, /min-h-11/);
  assert.match(panel, /min-w-11/);
  assert.doesNotMatch(panel, /animate-/);
});

test("optional context remains local and recommendations require explicit confirmation", () => {
  assert.match(panel, /is not stored or sent to the planner/);
  assert.match(panel, /selectedItemIds/);
  assert.match(panel, /Apply .*selected/);
  assert.match(panel, /type="checkbox"/);
});

test("loading, no-change, stale/failure, success, and undo states are represented", () => {
  assert.match(panel, /Revising your day/);
  assert.match(panel, /already fits/);
  assert.match(panel, /role="alert"/);
  assert.match(panel, /Your revised plan is active/);
  assert.match(panel, /Undo revision/);
  assert.match(panel, /aria-live="polite"/);
});
