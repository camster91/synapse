import assert from "node:assert/strict";
import test from "node:test";
import { calculateAdaptiveBusyMinutes } from "../src/lib/adaptive-calendar";

const start = new Date("2026-09-03T16:00:00.000Z");
const end = new Date("2026-09-03T20:00:00.000Z");

test("overlapping events are merged instead of double counted", () => {
  assert.equal(calculateAdaptiveBusyMinutes([
    { startAt: "2026-09-03T16:30:00.000Z", endAt: "2026-09-03T18:00:00.000Z" },
    { startAt: "2026-09-03T17:30:00.000Z", endAt: "2026-09-03T19:00:00.000Z" },
  ], start, end), 150);
});

test("events are clipped to the declared planning window", () => {
  assert.equal(calculateAdaptiveBusyMinutes([
    { startAt: "2026-09-03T15:00:00.000Z", endAt: "2026-09-03T17:00:00.000Z" },
    { startAt: "2026-09-03T19:30:00.000Z", endAt: "2026-09-03T21:00:00.000Z" },
  ], start, end), 90);
});

test("invalid and zero-duration events consume no capacity", () => {
  assert.equal(calculateAdaptiveBusyMinutes([
    { startAt: "invalid", endAt: "2026-09-03T17:00:00.000Z" },
    { startAt: "2026-09-03T17:00:00.000Z", endAt: null },
  ], start, end), 0);
});
