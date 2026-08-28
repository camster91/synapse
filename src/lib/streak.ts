function formatter(timezone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
}

function dateKey(date: Date, format: Intl.DateTimeFormat): string {
  const parts = format.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function previousDateKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}

export function calculateActivityStreak(
  activityDates: Date[],
  timezone: string,
  now = new Date()
): number {
  const format = formatter(timezone);
  const activeDays = new Set(activityDates.map((date) => dateKey(date, format)));
  let currentDay = dateKey(now, format);
  let streak = 0;

  while (activeDays.has(currentDay)) {
    streak += 1;
    currentDay = previousDateKey(currentDay);
  }

  return streak;
}
