import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const applyRoute = readFileSync("src/app/api/adaptive-planning/apply/route.ts", "utf8");
const undoRoute = readFileSync("src/app/api/adaptive-planning/undo/route.ts", "utf8");
const storage = readFileSync("src/lib/adaptive-storage.ts", "utf8");
const migration = readFileSync("prisma/migrations/20260903200000_add_adaptive_planning_state/migration.sql", "utf8");

test("apply revalidates current planning state immediately before mutation", () => {
  assert.match(applyRoute, /rebuildAdaptiveSnapshot/);
  assert.match(applyRoute, /hashPlanningSnapshot\(currentSnapshot\)/);
  assert.match(applyRoute, /Generate a fresh proposal/);
});

test("apply only accepts actions that match the signed deterministic proposal", () => {
  assert.match(applyRoute, /proposed\.action !== accepted\.action/);
  assert.match(applyRoute, /Accepted action does not match the signed proposal/);
});

test("storage applies task changes and change record in one transaction", () => {
  assert.match(storage, /prisma\.\$transaction/);
  assert.match(storage, /UPDATE todos/);
  assert.match(storage, /INSERT INTO adaptive_plan_changes/);
  assert.match(storage, /Adaptive plan changed before apply/);
});

test("duplicate proposal application is idempotent", () => {
  assert.match(storage, /WHERE "proposalId" = \$\{input\.proposalId\}/);
  assert.match(storage, /duplicate: true/);
  assert.match(migration, /UNIQUE INDEX "adaptive_plan_changes_proposalId_key"/);
});

test("undo is authenticated, bounded, and fails on newer edits", () => {
  assert.match(undoRoute, /const session = await auth\(\)/);
  assert.match(storage, /Adaptive undo expired/);
  assert.match(storage, /Adaptive undo conflicts with newer edits/);
  assert.match(storage, /"updatedAt" = \$\{new Date\(undo\.updatedAt\)\}/);
});

test("migration preserves existing deadlines while adding explicit adaptive fields", () => {
  assert.match(migration, /ADD COLUMN "estimatedMinutes" INTEGER/);
  assert.match(migration, /ADD COLUMN "minimumMinutes" INTEGER/);
  assert.match(migration, /ADD COLUMN "deferredUntil" TIMESTAMP\(3\)/);
  assert.doesNotMatch(migration, /UPDATE "?todos"?/i);
  assert.match(migration, /minimumMinutes.*estimated/s);
});
