import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, subDays, format } from 'date-fns';

interface UserContextOptions {
  timezone?: string;
}

export async function buildUserContext(
  userId: string,
  options?: UserContextOptions
): Promise<string> {
  const tz = options?.timezone ?? 'America/New_York';
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const sections: string[] = [];

  // Fetch data in parallel
  const [
    habits,
    habitLogs,
    todos,
    todayEvents,
    activeGoals,
    recentJournals,
    inboxCount,
  ] = await Promise.all([
    // Habits
    prisma.habit.findMany({
      where: { userId, archived: false },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, frequency: true, targetCount: true },
    }),

    // Today's habit logs
    prisma.habitLog.findMany({
      where: {
        userId,
        date: { gte: todayStart, lte: todayEnd },
      },
      select: { habitId: true, count: true },
    }),

    // Active todos (top 10 by priority)
    prisma.todo.findMany({
      where: {
        userId,
        status: { in: ['INBOX', 'TODO', 'IN_PROGRESS'] },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
    }),

    // Today's calendar events
    prisma.calendarEvent.findMany({
      where: {
        userId,
        startAt: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { startAt: 'asc' },
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        allDay: true,
        location: true,
      },
    }),

    // Active goals
    prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ level: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        level: true,
        progress: true,
        endDate: true,
      },
    }),

    // Recent journal entries (last 3)
    prisma.journal.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 3,
      select: {
        id: true,
        date: true,
        content: true,
        mood: true,
      },
    }),

    // Unprocessed inbox count
    prisma.inboxItem.count({
      where: { userId, processed: false },
    }),
  ]);

  // ─── Build sections ────────────────────────────────────────────────────────

  // Today's date
  sections.push(`CURRENT DATE: ${format(now, 'EEEE, MMMM d, yyyy')}`);

  // Habits
  if (habits.length > 0) {
    const completedHabitIds = new Set(habitLogs.map((l) => l.habitId));
    const habitLines = habits.map((h) => {
      const done = completedHabitIds.has(h.id) ? 'DONE' : 'PENDING';
      return `- ${h.name} (${h.frequency}, target: ${h.targetCount}) [${done}]`;
    });
    sections.push(
      `HABITS (${habits.length} total, ${habitLogs.length} completed today):\n${habitLines.join('\n')}`
    );
  }

  // Todos
  if (todos.length > 0) {
    const todoLines = todos.map((t) => {
      const due = t.dueDate ? ` due:${format(t.dueDate, 'MMM d')}` : '';
      return `- [${t.status}] ${t.title} (priority:${t.priority})${due}`;
    });
    sections.push(`ACTIVE TODOS (top ${todos.length}):\n${todoLines.join('\n')}`);
  }

  // Calendar
  if (todayEvents.length > 0) {
    const eventLines = todayEvents.map((e) => {
      const time = e.allDay
        ? 'All day'
        : `${format(e.startAt, 'h:mm a')}${e.endAt ? `-${format(e.endAt, 'h:mm a')}` : ''}`;
      const loc = e.location ? ` @ ${e.location}` : '';
      return `- ${time}: ${e.title}${loc}`;
    });
    sections.push(
      `TODAY'S CALENDAR (${todayEvents.length} events):\n${eventLines.join('\n')}`
    );
  }

  // Goals
  if (activeGoals.length > 0) {
    const goalLines = activeGoals.map((g) => {
      const endDate = g.endDate ? ` by ${format(g.endDate, 'MMM d')}` : '';
      return `- [${g.level}] ${g.title} — ${g.progress}%${endDate}`;
    });
    sections.push(
      `GOALS (${activeGoals.length} active):\n${goalLines.join('\n')}`
    );
  }

  // Recent journal
  if (recentJournals.length > 0) {
    const journalLines = recentJournals.map((j) => {
      const mood = j.mood ? ` (mood: ${j.mood}/10)` : '';
      const preview = j.content.length > 150 ? j.content.slice(0, 150) + '...' : j.content;
      return `- ${format(j.date, 'MMM d')}${mood}: ${preview}`;
    });
    sections.push(
      `RECENT JOURNAL (${recentJournals.length} entries):\n${journalLines.join('\n')}`
    );
  }

  // Inbox
  if (inboxCount > 0) {
    sections.push(`INBOX: ${inboxCount} unprocessed item${inboxCount > 1 ? 's' : ''}`);
  }

  const context = sections.join('\n\n');

  return context;
}