import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync("src/app/api/dashboard/route.ts", "utf8");
const context = readFileSync("src/lib/adaptive-context.ts", "utf8");

test("Today excludes only tasks whose bounded deferral is active", () => {
  assert.match(dashboard, /deferredUntil: null/);
  assert.match(dashboard, /deferredUntil: \{ lte: now \}/);
  assert.match(dashboard, /take: 10/);
  assert.doesNotMatch(dashboard, /loadAdaptiveEffortMetadata/);
});

test("adaptive preview uses the same visible-Today rule directly in Prisma", () => {
  assert.match(context, /deferredUntil: null/);
  assert.match(context, /deferredUntil: \{ lte: input\.now \}/);
  assert.match(context, /estimatedMinutes: todo\.estimatedMinutes/);
  assert.match(context, /minimumMinutes: todo\.minimumMinutes/);
  assert.match(context, /updatedAt: todo\.updatedAt\.toISOString\(\)/);
});
