import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260903200000_add_adaptive_planning_state/migration.sql", "utf8");

test("Prisma schema matches the adaptive migration", () => {
  assert.match(schema, /estimatedMinutes\s+Int\?/);
  assert.match(schema, /minimumMinutes\s+Int\?/);
  assert.match(schema, /deferredUntil\s+DateTime\?/);
  assert.match(schema, /model AdaptivePlanChange/);
  assert.match(schema, /proposalId\s+String\s+@unique/);
  assert.match(schema, /beforeState\s+Json/);
  assert.match(schema, /afterState\s+Json/);
  assert.match(schema, /adaptivePlanChanges AdaptivePlanChange\[\]/);
  assert.match(schema, /@@index\(\[userId, deferredUntil\]\)/);
});

test("schema and migration use the same tables, index, and effort invariant", () => {
  assert.match(schema, /@@map\("adaptive_plan_changes"\)/);
  assert.match(migration, /CREATE TABLE "adaptive_plan_changes"/);
  assert.match(migration, /todos_userId_deferredUntil_idx/);
  assert.match(migration, /"minimumMinutes" IS NULL OR \("estimatedMinutes" IS NOT NULL/);
});
