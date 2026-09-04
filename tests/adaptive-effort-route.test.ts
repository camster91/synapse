import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/todos/[id]/effort/route.ts", "utf8");

test("effort edits are authenticated and tenant scoped", () => {
  assert.match(route, /const session = await auth\(\)/);
  assert.match(route, /where: \{ id, userId: session\.user\.id \}/);
  assert.match(route, /updateMany/);
});

test("minimum effort cannot exceed the estimate", () => {
  assert.match(route, /minimumMinutes > estimatedMinutes/);
  assert.match(route, /Minimum effort must be less than or equal to the estimate/);
});

test("clearing an estimate also clears its dependent minimum", () => {
  assert.match(route, /if \(estimatedMinutes === null\) minimumMinutes = null/);
});
