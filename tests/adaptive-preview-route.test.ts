import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/adaptive-planning/preview/route.ts", "utf8");

test("adaptive preview requires authentication and scopes all reads to the user", () => {
  assert.match(route, /const session = await auth\(\)/);
  assert.match(route, /userId,/);
  assert.match(route, /prisma\.todo\.findMany/);
  assert.match(route, /prisma\.calendarEvent\.findMany/);
});

test("adaptive preview performs no database mutation", () => {
  assert.doesNotMatch(route, /\.create\(/);
  assert.doesNotMatch(route, /\.update\(/);
  assert.doesNotMatch(route, /\.delete\(/);
  assert.doesNotMatch(route, /\$transaction/);
});

test("unknown todo effort stays unknown rather than being fabricated", () => {
  assert.match(route, /estimatedMinutes: null/);
});

test("adaptive preview is explicitly non-cacheable", () => {
  assert.match(route, /"Cache-Control": "no-store"/);
});
