export function safeTimeZone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return "UTC";
  }
}

function parts(date: Date, timezone: string, includeTime = false): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" as const }
      : {}),
  });
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

export function localDayKey(date: Date, timezone: string): string {
  const value = parts(date, timezone);
  return `${value.year}-${value.month}-${value.day}`;
}

export function addDaysToDayKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Invalid day key");
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function localDateTimeKey(date: Date, timezone: string): string {
  const value = parts(date, timezone, true);
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}`;
}

export function zonedDateTimeToUtc(
  dayKey: string,
  time: { hour: number; minute?: number; second?: number },
  timezone: string
): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day || time.hour < 0 || time.hour > 23) {
    throw new Error("Invalid zoned date-time");
  }
  const minute = time.minute ?? 0;
  const second = time.second ?? 0;
  if (minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new Error("Invalid zoned date-time");
  }

  const target = `${dayKey}T${String(time.hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
  const center = Date.UTC(year, month - 1, day, time.hour, minute, second);
  let low = center - 36 * 60 * 60 * 1000;
  let high = center + 36 * 60 * 60 * 1000;

  while (low < high) {
    const midpoint = Math.floor((low + high) / 2);
    if (localDateTimeKey(new Date(midpoint), timezone) < target) low = midpoint + 1;
    else high = midpoint;
  }

  const result = new Date(low);
  if (localDateTimeKey(result, timezone) !== target) {
    throw new Error("Local date-time does not exist in this timezone");
  }
  return result;
}

export function localDayBounds(now: Date, timezone: string): {
  dayKey: string;
  start: Date;
  end: Date;
} {
  const dayKey = localDayKey(now, timezone);
  return {
    dayKey,
    start: zonedDateTimeToUtc(dayKey, { hour: 0 }, timezone),
    end: zonedDateTimeToUtc(addDaysToDayKey(dayKey, 1), { hour: 0 }, timezone),
  };
}
