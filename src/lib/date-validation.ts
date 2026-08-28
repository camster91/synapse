import { z } from "zod/v4";

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD)")
  .refine(isRealDate, "Date does not exist");

export const isoDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/,
    "Expected an ISO date-time with a timezone"
  )
  .refine((value) => !Number.isNaN(Date.parse(value)), "Date-time is invalid");

export const isoDateOrDateTimeSchema = z.union([
  isoDateSchema,
  isoDateTimeSchema,
]);

export const recurrenceSchema = z
  .string()
  .max(1000)
  .regex(
    /^(?:RRULE:)?FREQ=(?:DAILY|WEEKLY|MONTHLY|YEARLY)(?:;[A-Z]+=[A-Z0-9,+-]+)*$/,
    "Recurrence must be a supported RRULE"
  );

export function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
