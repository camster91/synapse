import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addXp } from '@/lib/xp';
import { sendPushNotification } from '@/lib/push';
import { fireHookForUser } from '@/lib/plugins/executor';
import { z } from 'zod/v4';

const logHabitSchema = z.object({
  date: z.string().optional(), // ISO date string, defaults to today
  count: z.int().min(1).default(1),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: habitId } = await params;

  try {
    const body = await request.json();
    const data = logHabitSchema.parse(body);

    // Verify habit belongs to user
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId: session.user.id },
    });

    if (!habit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    const date = data.date ? new Date(data.date) : new Date();
    // Normalize to start of day
    date.setHours(0, 0, 0, 0);

    const log = await prisma.habitLog.upsert({
      where: { habitId_date: { habitId, date } },
      update: { count: { increment: data.count }, note: data.note },
      create: {
        habitId,
        userId: session.user.id,
        date,
        count: data.count,
        note: data.note,
      },
    });

    // Award XP for habit completion
    await addXp(session.user.id, 5, 'habit_completed', habitId);

    // Recalculate streak
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let streakCount = 0;
      let checkDate = new Date(today);

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const nextDay = new Date(checkDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const logsOnDay = await prisma.habitLog.findFirst({
          where: {
            userId: session.user.id,
            date: { gte: checkDate, lt: nextDay },
          },
        });

        if (logsOnDay) {
          streakCount++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      const updateData: { streakDays: number; lastActiveAt: Date; longestStreak?: number } = {
        streakDays: streakCount,
        lastActiveAt: new Date(),
      };

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { longestStreak: true },
      });

      if (streakCount > (user?.longestStreak ?? 0)) {
        updateData.longestStreak = streakCount;
      }

      // Streak milestone notifications
      const milestones = [7, 14, 30, 60, 90, 365];
      if (milestones.includes(streakCount)) {
        sendPushNotification(session.user.id, {
          title: `${streakCount}-Day Streak!`,
          body: `Amazing! You've been active for ${streakCount} days in a row.`,
          actionUrl: "/habits",
          tag: "streak",
        }).catch(() => {});
      }

      await prisma.user.update({
        where: { id: session.user.id },
        data: updateData,
      });
    } catch (streakErr) {
      console.error('Failed to update streak:', streakErr);
    }

    // Fire plugin hook
    try {
      await fireHookForUser(session.user.id, 'onHabitCompleted', log);
    } catch (hookErr) {
      console.error('Plugin hook onHabitCompleted failed:', hookErr);
    }

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('Failed to log habit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}