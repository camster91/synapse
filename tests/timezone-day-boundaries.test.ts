import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addDaysToDayKey,
  localDayBounds,
  localDayKey,
  zonedDateTimeToUtc,
} from "../src/lib/timezone";

test("local day bounds honor DST transitions instead of assuming 24 hours", () => {
  const spring = localDayBounds(new Date("2026-03-08T17:00:00.000Z"), "America/Toronto");
  assert.equal(spring.dayKey, "2026-03-08");
  assert.equal(spring.start.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(spring.end.toISOString(), "2026-03-09T04:00:00.000Z");

  const fall = localDayBounds(new Date("2026-11-01T17:00:00.000Z"), "America/Toronto");
  assert.equal(fall.start.toISOString(), "2026-11-01T04:00:00.000Z");
  assert.equal(fall.end.toISOString(), "2026-11-02T05:00:00.000Z");
});

test("tomorrow scheduling and invalid zones resolve deterministically", () => {
  const day = localDayKey(new Date("2026-03-08T17:00:00.000Z"), "America/Toronto");
  const tomorrow = addDaysToDayKey(day, 1);
  assert.equal(zonedDateTimeToUtc(tomorrow, { hour: 9 }, "America/Toronto").toISOString(), "2026-03-09T13:00:00.000Z");
  assert.equal(localDayKey(new Date("2026-09-01T23:30:00.000Z"), "not-a-zone"), "2026-09-01");
});

test("Today and habit logging use the account timezone for customer-visible days", () => {
  const dashboardApi = readFileSync("src/app/api/dashboard/route.ts", "utf8");
  const dashboard = readFileSync("src/components/DashboardPage.tsx", "utf8");
  const habitLog = readFileSync("src/app/api/habits/[id]/log/route.ts", "utf8");

  assert.match(dashboardApi, /localDayBounds\(new Date\(\), timezone\)/);
  assert.match(dashboardApi, /timezone,/);
  assert.match(dashboard, /localDayKey\(new Date\(\), data\.timezone\)/);
  assert.match(dashboard, /zonedDateTimeToUtc\(tomorrowDay, \{ hour: 9 \}, data\.timezone\)/);
  assert.match(dashboard, /timeZone: data\.timezone/);
  assert.match(habitLog, /localDayKey\(new Date\(\), user\?\.timezone \?\? 'UTC'\)/);
});
