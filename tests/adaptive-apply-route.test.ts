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

test("the browser selects item ids but cannot substitute action targets", () => {
  assert.match(applyRoute, /selectedItemIds/);
  assert.doesNotMatch(applyRoute, /targetScheduledAt: z\./);
  assert.doesNotMatch(applyRoute, /targetDeferredUntil: z\./);
  assert.match(applyRoute, /claims\.plan\.recommendations/);
  assert.doesNotMatch(applyRoute, /buildAdaptivePlan/);
  assert.match(applyRoute, /targetScheduledAt: recommendation\.targetScheduledAt/);
  assert.match(applyRoute, /targetDeferredUntil: recommendation\.targetDeferredUntil/);
  assert.match(applyRoute, /targetEstimatedMinutes: recommendation\.targetEstimatedMinutes/);
});

test("storage applies all task changes and the change record in one transaction", () => {
  assert.match(storage, /prisma\.\$transaction/);
  assert.match(storage, /tx\.todo\.updateMany/);
  assert.match(storage, /tx\.adaptivePlanChange\.create/);
  assert.match(storage, /Adaptive plan changed before apply/);
});

test("duplicate proposal application is idempotent", () => {
  assert.match(storage, /findUnique\(\{\s*where: \{ proposalId: input\.proposalId \}/s);
  assert.match(storage, /duplicate: true/);
  assert.match(storage, /concurrent replay/);
  assert.match(migration, /UNIQUE INDEX "adaptive_plan_changes_proposalId_key"/);
});

test("undo is authenticated, bounded, tenant scoped, and fails on newer edits", () => {
  assert.match(undoRoute, /const session = await auth\(\)/);
  assert.match(storage, /Adaptive undo expired/);
  assert.match(storage, /Adaptive undo conflicts with newer edits/);
  assert.match(storage, /userId: input\.userId/);
  assert.match(storage, /updatedAt: new Date\(current\.updatedAt\)/);
});

test("migration is additive and preserves existing deadlines", () => {
  assert.match(migration, /ADD COLUMN "estimatedMinutes" INTEGER/);
  assert.match(migration, /ADD COLUMN "minimumMinutes" INTEGER/);
  assert.match(migration, /ADD COLUMN "deferredUntil" TIMESTAMP\(3\)/);
  assert.doesNotMatch(migration, /UPDATE "?todos"?/i);
  assert.match(migration, /minimumMinutes.*estimated/s);
});
