import { prisma } from "@/lib/prisma";
import { loadAdaptiveEffortMetadata } from "@/lib/adaptive-effort";
import type { PlanningSnapshot } from "@/lib/adaptive-planning";

export async function rebuildAdaptiveSnapshot(userId: string, original: PlanningSnapshot) {
  const originalNow = new Date(original.now);
  const horizon = new Date(originalNow.getTime() + original.remainingMinutes * 60_000);
  if (Number.isNaN(originalNow.getTime()) || Number.isNaN(horizon.getTime())) {
    throw new Error("Invalid planning snapshot");
  }

  const [todos, events] = await Promise.all([
    prisma.todo.findMany({
      where: {
        userId,
        status: { in: ["INBOX", "TODO", "IN_PROGRESS"] },
        OR: [
          { scheduledAt: { lte: horizon } },
          { dueDate: { lte: horizon } },
          { scheduledAt: null, dueDate: null, priority: { gte: 3 } },
        ],
      },
      orderBy: [{ priority: "desc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        priority: true,
        dueDate: true,
        scheduledAt: true,
        completedAt: true,
        goalId: true,
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        startAt: { lt: horizon },
        OR: [{ endAt: null }, { endAt: { gt: originalNow } }],
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const effort = await loadAdaptiveEffortMetadata(userId, todos.map((todo) => todo.id));
  const visibleTodos = todos.filter((todo) => {
    const deferredUntil = effort.get(todo.id)?.deferredUntil;
    return !deferredUntil || new Date(deferredUntil).getTime() <= originalNow.getTime();
  });

  const calendarBusyMinutes = events.reduce((total, event) => {
    const start = Math.max(originalNow.getTime(), event.startAt.getTime());
    const end = Math.min(horizon.getTime(), (event.endAt ?? event.startAt).getTime());
    return total + Math.max(0, Math.round((end - start) / 60_000));
  }, 0);

  return {
    now: original.now,
    remainingMinutes: original.remainingMinutes,
    capacity: original.capacity,
    calendarBusyMinutes,
    items: visibleTodos.map((todo) => ({
      id: todo.id,
      priority: todo.priority,
      dueAt: todo.dueDate?.toISOString() ?? null,
      estimatedMinutes: effort.get(todo.id)?.estimatedMinutes ?? null,
      goalId: todo.goalId,
      completed: Boolean(todo.completedAt),
      scheduledAt: todo.scheduledAt?.toISOString() ?? null,
    })),
  } satisfies PlanningSnapshot;
}
