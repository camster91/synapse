import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/adaptive-planning/revalidate/route.ts", "utf8");
const current = readFileSync("src/lib/adaptive-current-snapshot.ts", "utf8");
const context = readFileSync("src/lib/adaptive-context.ts", "utf8");

test("revalidation requires auth and a user-bound signed token", () => {
  assert.match(route, /const session = await auth\(\)/);
  assert.match(route, /verifyAdaptiveConfirmation/);
  assert.match(route, /session\.user\.id/);
});

test("revalidation rebuilds the same tenant-scoped planning contract", () => {
  assert.match(current, /loadAdaptivePlanningContext/);
  assert.match(context, /userId: input\.userId/);
  assert.match(context, /updatedAt: todo\.updatedAt\.toISOString\(\)/);
  assert.match(route, /hashPlanningSnapshot\(currentSnapshot\)/);
});

test("stale proposals fail closed without mutation", () => {
  assert.match(route, /status: 409/);
  assert.match(route, /Generate a fresh proposal/);
  assert.doesNotMatch(route, /\.create\(/);
  assert.doesNotMatch(route, /\.update\(/);
  assert.doesNotMatch(route, /\.delete\(/);
  assert.doesNotMatch(route, /\$transaction/);
});
