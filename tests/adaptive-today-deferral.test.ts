import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync("src/app/api/dashboard/route.ts", "utf8");
const preview = readFileSync("src/app/api/adaptive-planning/preview/route.ts", "utf8");

test("Today excludes only tasks whose adaptive deferral is still active", () => {
  assert.match(dashboard, /loadAdaptiveEffortMetadata/);
  assert.match(dashboard, /deferredUntil/);
  assert.match(dashboard, /new Date\(deferredUntil\)\.getTime\(\) <= now\.getTime\(\)/);
  assert.match(dashboard, /\.slice\(0, 10\)/);
});

test("adaptive preview applies the same deferral visibility rule", () => {
  assert.match(preview, /loadAdaptiveEffortMetadata/);
  assert.match(preview, /deferredUntil/);
  assert.match(preview, /estimatedMinutes: effort\.get\(todo\.id\)\?\.estimatedMinutes \?\? null/);
});
