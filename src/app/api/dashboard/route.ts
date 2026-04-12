import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Run all queries in parallel
    const [
      habitsWithLogs,
      activeTodos,
      todayEvents,
      user,
      recentJournal,
      unprocessedInboxCount,
    ] = await Promise.all([
      // Today's habits with today's logs
      prisma.habit.findMany({
        where: { userId, archived: false },
        include: {
          logs: {
            where: {
              date: { gte: today, lt: tomorrow },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),

      // Active todos (top 10 by priority)
      prisma.todo.findMany({
        where: {
          userId,
          status: { in: ["INBOX", "TODO", "IN_PROGRESS"] },
        },
        orderBy: [{ priority: "desc" }, { sortOrder: "asc" }],
        take: 10,
        include: { tags: { select: { id: true, name: true, color: true } } },
      }),

      // Today's calendar events
      prisma.calendarEvent.findMany({
        where: {
          userId,
          startAt: { gte: today, lt: tomorrow },
        },
        orderBy: { startAt: "asc" },
      }),

      // User gamification data
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          xp: true,
          level: true,
          streakDays: true,
          name: true,
        },
      }),

      // Recent journal entry (last 3 days)
      prisma.journal.findFirst({
        where: {
          userId,
          date: { gte: threeDaysAgo },
        },
        orderBy: { date: "desc" },
      }),

      // Unprocessed inbox count
      prisma.inboxItem.count({
        where: { userId, processed: false },
      }),
    ]);

    // Calculate habits completed / total for today
    const habitsCompleted = habitsWithLogs.filter(
      (h) => h.logs.length > 0 && h.logs.some((log) => log.count >= h.targetCount)
    ).length;
    const habitsTotal = habitsWithLogs.length;

    return NextResponse.json({
      habits: {
        items: habitsWithLogs,
        completed: habitsCompleted,
        total: habitsTotal,
      },
      todos: activeTodos,
      events: todayEvents,
      user: {
        xp: user?.xp ?? 0,
        level: user?.level ?? 1,
        streakDays: user?.streakDays ?? 0,
        name: user?.name ?? null,
      },
      recentJournal,
      unprocessedInbox: unprocessedInboxCount,
    });
  } catch (error) {
    console.error("Failed to load dashboard:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}