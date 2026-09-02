import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { calculateActivityStreak } from "../src/lib/streak";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("activity streak counts unique consecutive local days", () => {
  const now = new Date("2026-08-28T16:00:00Z");
  const dates = [
    new Date("2026-08-28T13:00:00Z"),
    new Date("2026-08-28T15:00:00Z"),
    new Date("2026-08-27T13:00:00Z"),
    new Date("2026-08-26T13:00:00Z"),
    new Date("2026-08-24T13:00:00Z"),
  ];

  assert.equal(calculateActivityStreak(dates, "America/Toronto", now), 3);
});

test("activity streak respects timezone day boundaries", () => {
  const now = new Date("2026-08-28T01:00:00Z");
  const activity = [new Date("2026-08-27T23:30:00Z")];

  assert.equal(calculateActivityStreak(activity, "America/Toronto", now), 1);
  assert.equal(calculateActivityStreak(activity, "UTC", now), 0);
});

test("invalid saved timezones fall back safely", () => {
  const now = new Date("2026-08-28T12:00:00Z");
  assert.equal(
    calculateActivityStreak([new Date("2026-08-28T08:00:00Z")], "not/a-zone", now),
    1
  );
});

test("habit logging calculates streaks without a query-per-day loop", () => {
  const route = readFileSync(
    path.join(root, "src/app/api/habits/[id]/log/route.ts"),
    "utf8"
  );

  assert.match(route, /prisma\.habitLog\.findMany/);
  assert.match(route, /calculateActivityStreak/);
  assert.doesNotMatch(route, /while \(true\)/);
  assert.doesNotMatch(route, /prisma\.habitLog\.findFirst/);
});
