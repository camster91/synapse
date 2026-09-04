import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordProductEvent } from "@/lib/product-metrics";
import { dateOnlyToUtc } from "@/lib/date-validation";
import { addDaysToDayKey, localDayBounds, safeTimeZone } from "@/lib/timezone";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true, streakDays: true, name: true, timezone: true },
    });
    const timezone = safeTimeZone(user?.timezone ?? "UTC");
    const now = new Date();
    const { dayKey, start: today, end: tomorrow } = localDayBounds(now, timezone);
    const habitToday = dateOnlyToUtc(dayKey);
    const habitTomorrow = dateOnlyToUtc(addDaysToDayKey(dayKey, 1));
    const threeDaysAgo = dateOnlyToUtc(addDaysToDayKey(dayKey, -3));

    const [
      habitsWithLogs,
      activeTodos,
      todayEvents,
      recentJournal,
      unprocessedInboxCount,
      activeGoals,
      inboxItems,
    ] = await Promise.all([
      prisma.habit.findMany({
        where: { userId, archived: false },
        include: { logs: { where: { date: { gte: habitToday, lt: habitTomorrow } } } },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.todo.findMany({
        where: {
          userId,
          status: { in: ["INBOX", "TODO", "IN_PROGRESS"] },
          AND: [
            {
              OR: [
                { scheduledAt: { gte: today, lt: tomorrow } },
                { dueDate: { lt: tomorrow } },
                { scheduledAt: null, dueDate: null, priority: { gte: 3 } },
              ],
            },
            { OR: [{ deferredUntil: null }, { deferredUntil: { lte: now } }] },
          ],
        },
        orderBy: [{ priority: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        take: 10,
        include: {
          tags: { select: { id: true, name: true, color: true } },
          goal: { select: { id: true, title: true } },
        },
      }),
      prisma.calendarEvent.findMany({
        where: { userId, startAt: { gte: today, lt: tomorrow } },
        orderBy: { startAt: "asc" },
      }),
      prisma.journal.findFirst({
        where: { userId, date: { gte: threeDaysAgo } },
        orderBy: { date: "desc" },
      }),
      prisma.inboxItem.count({ where: { userId, processed: false } }),
      prisma.goal.findMany({
        where: { userId, status: "ACTIVE" },
        orderBy: [{ level: "asc" }, { createdAt: "desc" }],
        take: 3,
        select: { id: true, title: true, level: true, progress: true },
      }),
      prisma.inboxItem.findMany({
        where: { userId, processed: false },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, content: true, type: true, createdAt: true },
      }),
    ]);

    const habitsCompleted = habitsWithLogs.filter(
      (habit) => habit.logs.some((log) => log.count >= habit.targetCount),
    ).length;

    await recordProductEvent({ userId, name: "TODAY_OPENED", timezone });

    return NextResponse.json({
      habits: { items: habitsWithLogs, completed: habitsCompleted, total: habitsWithLogs.length },
      todos: activeTodos,
      events: todayEvents,
      user: {
        xp: user?.xp ?? 0,
        level: user?.level ?? 1,
        streakDays: user?.streakDays ?? 0,
        name: user?.name ?? null,
        timezone,
      },
      recentJournal,
      unprocessedInbox: unprocessedInboxCount,
      goals: activeGoals,
      inboxItems,
    });
  } catch (error) {
    console.error("Failed to load dashboard:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
