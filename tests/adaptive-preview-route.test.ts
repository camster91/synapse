import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/adaptive-planning/preview/route.ts", "utf8");
const context = readFileSync("src/lib/adaptive-context.ts", "utf8");

test("preview requires authentication and delegates tenant-scoped context loading", () => {
  assert.match(route, /const session = await auth\(\)/);
  assert.match(route, /userId: session\.user\.id/);
  assert.match(context, /userId: input\.userId/);
  assert.match(context, /prisma\.todo\.findMany/);
  assert.match(context, /prisma\.calendarEvent\.findMany/);
});

test("preview performs no mutation and returns non-cacheable signed targets", () => {
  assert.doesNotMatch(route, /\.create\(/);
  assert.doesNotMatch(route, /\.update\(/);
  assert.doesNotMatch(route, /\.delete\(/);
  assert.doesNotMatch(route, /\$transaction/);
  assert.match(route, /signAdaptiveConfirmation/);
  assert.match(route, /plan: proposal\.plan/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.match(context, /moveTargetAt/);
  assert.match(context, /dropUntil/);
});

test("preview binds effort and task revision while returning display labels separately", () => {
  assert.match(route, /displayItems/);
  assert.match(context, /estimatedMinutes: todo\.estimatedMinutes/);
  assert.match(context, /minimumMinutes: todo\.minimumMinutes/);
  assert.match(context, /updatedAt: todo\.updatedAt\.toISOString\(\)/);
  assert.match(context, /title: todo\.title/);
  assert.doesNotMatch(readFileSync("src/lib/adaptive-proposals.ts", "utf8"), /title:/);
});
