import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  dateOnlyToUtc,
  isoDateSchema,
  isoDateTimeSchema,
  recurrenceSchema,
} from "../src/lib/date-validation";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

test("ISO date validation rejects malformed and impossible dates", () => {
  assert.equal(isoDateSchema.safeParse("2026-08-28").success, true);
  assert.equal(isoDateSchema.safeParse("2026-02-29").success, false);
  assert.equal(isoDateSchema.safeParse("08/28/2026").success, false);
  assert.equal(isoDateSchema.safeParse("2026-13-01").success, false);
});

test("date-time validation requires an explicit timezone", () => {
  assert.equal(isoDateTimeSchema.safeParse("2026-08-28T15:30:00Z").success, true);
  assert.equal(isoDateTimeSchema.safeParse("2026-08-28T15:30-04:00").success, true);
  assert.equal(isoDateTimeSchema.safeParse("2026-08-28T15:30").success, false);
  assert.equal(isoDateTimeSchema.safeParse("tomorrow").success, false);
});

test("date-only persistence is stable across server timezones", () => {
  assert.equal(dateOnlyToUtc("2026-08-28").toISOString(), "2026-08-28T00:00:00.000Z");
});

test("recurrence validation accepts bounded supported RRULEs", () => {
  assert.equal(recurrenceSchema.safeParse("FREQ=WEEKLY;BYDAY=MO,WE").success, true);
  assert.equal(recurrenceSchema.safeParse("RRULE:FREQ=MONTHLY;INTERVAL=2").success, true);
  assert.equal(recurrenceSchema.safeParse("every whenever").success, false);
});

test("calendar and goal routes enforce ordered boundaries", () => {
  const calendarCreate = read("src/app/api/calendar/route.ts");
  const calendarUpdate = read("src/app/api/calendar/[id]/route.ts");
  const goalCreate = read("src/app/api/goals/route.ts");
  const goalUpdate = read("src/app/api/goals/[id]/route.ts");

  assert.match(calendarCreate, /Event end must be after its start/);
  assert.match(calendarUpdate, /Event end must be after its start/);
  assert.match(goalCreate, /Goal end date must not precede its start date/);
  assert.match(goalUpdate, /Goal end date must not precede its start date/);
});

test("calendar UI converts local controls to zoned ISO values", () => {
  const calendar = read("src/app/(app)/calendar/page.tsx");
  assert.match(calendar, /new Date\(newStart\)\.toISOString\(\)/);
  assert.match(calendar, /new Date\(newEnd\)\.toISOString\(\)/);
  assert.match(calendar, /api\/calendar\?from=/);
});
