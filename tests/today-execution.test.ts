import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboardApi = readFileSync("src/app/api/dashboard/route.ts", "utf8");
const dashboard = readFileSync("src/components/DashboardPage.tsx", "utf8");

test("Today returns habits, focused goal-linked tasks, events, goals, and inbox captures", () => {
  assert.match(dashboardApi, /items: habitsWithLogs/);
  assert.match(dashboardApi, /goal: \{ select:/);
  assert.match(dashboardApi, /prisma\.goal\.findMany/);
  assert.match(dashboardApi, /goals: activeGoals/);
  assert.match(dashboardApi, /priority: \{ gte: 3 \}/);
  assert.match(dashboardApi, /inboxItems/);
});

test("Today directly completes tasks and habits through tenant-scoped APIs", () => {
  assert.match(dashboard, /fetch\(`\/api\/todos\/\$\{todoId\}`/);
  assert.match(dashboard, /JSON\.stringify\(\{ status: "DONE" \}\)/);
  assert.match(dashboard, /fetch\(`\/api\/habits\/\$\{habitId\}\/log`/);
  assert.match(dashboard, /aria-label=\{`Complete \$\{todo\.title\}`\}/);
});

test("failed Today actions restore the prior state and explain recovery", () => {
  assert.match(dashboard, /setData\(previous\)/);
  assert.match(dashboard, /Your Today view was restored/);
  assert.match(dashboard, /role="alert"/);
});

test("Today supports deliberate rescheduling and inbox triage", () => {
  assert.match(dashboard, /Move \$\{todo\.title\} to tomorrow/);
  assert.match(dashboard, /scheduledAt: tomorrow\.toISOString\(\), dueDate: null/);
  assert.match(dashboard, /fetch\(`\/api\/inbox\/\$\{itemId\}\/triage`/);
  assert.match(dashboard, /"todo" \| "note" \| "archive"/);
});

test("Today closes the loop with a draft-preserving reflection", () => {
  assert.match(dashboard, /fetch\("\/api\/journal"/);
  assert.match(dashboard, /What moved forward today\?/);
  assert.match(dashboard, /Close the day/);
  assert.match(dashboard, /Your draft is still here/);
});
