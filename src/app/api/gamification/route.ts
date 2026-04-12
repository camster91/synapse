import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const XP_PER_LEVEL = 100;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      xp: true,
      level: true,
      streakDays: true,
      longestStreak: true,
      lastActiveAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const achievements = await prisma.userAchievement.findMany({
    where: { userId: session.user.id },
    include: { achievement: true },
    orderBy: { earnedAt: 'desc' },
  });

  const recentXp = await prisma.xpTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const xpToNextLevel = XP_PER_LEVEL - (user.xp % XP_PER_LEVEL);

  return NextResponse.json({
    xp: user.xp,
    level: user.level,
    xpToNextLevel,
    streakDays: user.streakDays,
    longestStreak: user.longestStreak,
    lastActiveAt: user.lastActiveAt,
    achievementsCount: achievements.length,
    achievements,
    recentXp,
  });
}