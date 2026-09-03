import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/adaptive-planning/revalidate/route.ts", "utf8");

test("revalidation requires auth and a signed confirmation token", () => {
  assert.match(route, /const session = await auth\(\)/);
  assert.match(route, /verifyAdaptiveConfirmation/);
  assert.match(route, /session\.user\.id/);
});

test("revalidation rebuilds tenant-scoped todo and calendar state", () => {
  assert.match(route, /userId: session\.user\.id/);
  assert.match(route, /prisma\.todo\.findMany/);
  assert.match(route, /prisma\.calendarEvent\.findMany/);
  assert.match(route, /hashPlanningSnapshot\(currentSnapshot\)/);
});

test("stale proposals fail closed with no mutations", () => {
  assert.match(route, /status: 409/);
  assert.match(route, /Generate a fresh proposal/);
  assert.doesNotMatch(route, /\.create\(/);
  assert.doesNotMatch(route, /\.update\(/);
  assert.doesNotMatch(route, /\.delete\(/);
  assert.doesNotMatch(route, /\$transaction/);
});
