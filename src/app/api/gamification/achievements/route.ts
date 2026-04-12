import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all achievements
  const allAchievements = await prisma.achievement.findMany({
    orderBy: [{ category: 'asc' }, { xpReward: 'asc' }],
  });

  // Get user's earned achievements
  const earnedAchievements = await prisma.userAchievement.findMany({
    where: { userId: session.user.id },
    select: { achievementId: true, earnedAt: true },
  });

  const earnedMap = new Map(earnedAchievements.map((ua) => [ua.achievementId, ua.earnedAt]));

  // Merge: mark each achievement as earned or not
  const achievements = allAchievements.map((achievement) => ({
    ...achievement,
    earned: earnedMap.has(achievement.id),
    earnedAt: earnedMap.get(achievement.id) ?? null,
  }));

  return NextResponse.json(achievements);
}