import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync("src/components/DashboardPage.tsx", "utf8");

test("Today capture confirms success in-place and restores failed drafts", () => {
  assert.match(dashboard, /const capturedItem = await res\.json\(\)/);
  assert.match(dashboard, /inboxItems: \[capturedItem, \.\.\.data\.inboxItems\]/);
  assert.match(dashboard, /inboxUnprocessed: data\.inboxUnprocessed \+ 1/);
  assert.match(dashboard, /setQuickCapture\(prevCapture\)/);
  assert.match(dashboard, /Your draft has been restored\./);
  assert.match(dashboard, /disabled=\{!quickCapture\.trim\(\) \|\| capturing\}/);
  assert.match(dashboard, /role="alert"/);
});
