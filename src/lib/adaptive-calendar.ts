export interface AdaptiveBusyInterval {
  startAt: Date | string;
  endAt?: Date | string | null;
}

function timestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function calculateAdaptiveBusyMinutes(
  intervals: AdaptiveBusyInterval[],
  windowStart: Date,
  windowEnd: Date,
) {
  const start = windowStart.getTime();
  const end = windowEnd.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;

  const bounded = intervals
    .map((interval) => {
      const intervalStart = timestamp(interval.startAt);
      const intervalEnd = interval.endAt ? timestamp(interval.endAt) : intervalStart;
      if (intervalStart === null || intervalEnd === null) return null;
      const boundedStart = Math.max(start, intervalStart);
      const boundedEnd = Math.min(end, intervalEnd);
      return boundedEnd > boundedStart ? [boundedStart, boundedEnd] as const : null;
    })
    .filter((interval): interval is readonly [number, number] => interval !== null)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  let busyMilliseconds = 0;
  let currentStart: number | null = null;
  let currentEnd: number | null = null;

  for (const [intervalStart, intervalEnd] of bounded) {
    if (currentStart === null || currentEnd === null) {
      currentStart = intervalStart;
      currentEnd = intervalEnd;
      continue;
    }
    if (intervalStart <= currentEnd) {
      currentEnd = Math.max(currentEnd, intervalEnd);
      continue;
    }
    busyMilliseconds += currentEnd - currentStart;
    currentStart = intervalStart;
    currentEnd = intervalEnd;
  }

  if (currentStart !== null && currentEnd !== null) {
    busyMilliseconds += currentEnd - currentStart;
  }

  return Math.round(busyMilliseconds / 60_000);
}
