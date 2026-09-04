import { prisma } from "@/lib/prisma";
import { calculateAdaptiveBusyMinutes } from "@/lib/adaptive-calendar";
import type { PlanningCapacity, PlanningSnapshot } from "@/lib/adaptive-planning";
import {
  addDaysToDayKey,
  localDayKey,
  safeTimeZone,
  zonedDateTimeToUtc,
} from "@/lib/timezone";

export interface AdaptiveDisplayItem {
  id: string;
  title: string;
  goalTitle: string | null;
  dueDate: string | null;
  scheduledAt: string | null;
  estimatedMinutes: number | null;
  minimumMinutes: number | null;
}

export async function loadAdaptivePlanningContext(input: {
  userId: string;
  now: Date;
  remainingMinutes: number;
  capacity: PlanningCapacity;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { timezone: true },
  });
  const timezone = safeTimeZone(user?.timezone ?? "UTC");
  const horizon = new Date(input.now.getTime() + input.remainingMinutes * 60_000);
  const nextDayKey = addDaysToDayKey(localDayKey(input.now, timezone), 1);
  const moveTargetAt = zonedDateTimeToUtc(nextDayKey, { hour: 9 }, timezone).toISOString();
  const dropUntil = zonedDateTimeToUtc(nextDayKey, { hour: 0 }, timezone).toISOString();

  const [todos, events] = await Promise.all([
    prisma.todo.findMany({
      where: {
        userId: input.userId,
        status: { in: ["INBOX", "TODO", "IN_PROGRESS"] },
        AND: [
          {
            OR: [
              { scheduledAt: { lte: horizon } },
              { dueDate: { lte: horizon } },
              { scheduledAt: null, dueDate: null, priority: { gte: 3 } },
            ],
          },
          {
            OR: [
              { deferredUntil: null },
              { deferredUntil: { lte: input.now } },
            ],
          },
        ],
      },
      orderBy: [{ priority: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        priority: true,
        dueDate: true,
        scheduledAt: true,
        completedAt: true,
        estimatedMinutes: true,
        minimumMinutes: true,
        goalId: true,
        goal: { select: { title: true } },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId: input.userId,
        startAt: { lt: horizon },
        OR: [
          { endAt: { gt: input.now } },
          { endAt: null, startAt: { gte: input.now } },
        ],
      },
      orderBy: { startAt: "asc" },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const snapshot: PlanningSnapshot = {
    now: input.now.toISOString(),
    remainingMinutes: input.remainingMinutes,
    capacity: input.capacity,
    calendarBusyMinutes: calculateAdaptiveBusyMinutes(events, input.now, horizon),
    items: todos.map((todo) => ({
      id: todo.id,
      priority: todo.priority,
      dueAt: todo.dueDate?.toISOString() ?? null,
      estimatedMinutes: todo.estimatedMinutes,
      minimumMinutes: todo.minimumMinutes,
      goalId: todo.goalId,
      completed: Boolean(todo.completedAt),
      scheduledAt: todo.scheduledAt?.toISOString() ?? null,
      moveTargetAt,
      dropUntil,
    })),
  };

  const displayItems: AdaptiveDisplayItem[] = todos.map((todo) => ({
    id: todo.id,
    title: todo.title,
    goalTitle: todo.goal?.title ?? null,
    dueDate: todo.dueDate?.toISOString() ?? null,
    scheduledAt: todo.scheduledAt?.toISOString() ?? null,
    estimatedMinutes: todo.estimatedMinutes,
    minimumMinutes: todo.minimumMinutes,
  }));

  return { snapshot, displayItems, timezone };
}
