import { prisma } from "@/lib/prisma";

// ─── Level thresholds (cumulative XP required) ────────────────────────────────

const LEVEL_THRESHOLDS = [
  0, // Level 1
  100, // Level 2
  250, // Level 3
  500, // Level 4
  800, // Level 5
  1200, // Level 6
  1800, // Level 7
  2500, // Level 8
  3500, // Level 9
  5000, // Level 10
] as const;

/**
 * Calculate the user's level based on their total XP.
 * Levels follow an exponential curve with defined thresholds.
 */
export function calculateLevel(xp: number): number {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

/**
 * Add XP to a user, create a transaction record, and handle level-ups.
 * Returns the updated XP, level, and whether a level-up occurred.
 */
export async function addXp(
  userId: string,
  amount: number,
  reason: string,
  referenceId?: string
): Promise<{ xp: number; level: number; leveledUp: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error(`User not found: ${userId}`);

  const previousLevel = user.level;
  const newTotalXp = user.xp + amount;
  const newLevel = calculateLevel(newTotalXp);
  const leveledUp = newLevel > previousLevel;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { xp: newTotalXp, level: newLevel },
    }),
    prisma.xpTransaction.create({
      data: {
        userId,
        amount,
        reason,
        ...(referenceId ? { referenceId } : {}),
      },
    }),
  ]);

  return { xp: newTotalXp, level: newLevel, leveledUp };
}

// ─── Achievement definitions ──────────────────────────────────────────────────

export interface AchievementDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: "habits" | "journal" | "productivity" | "explorer";
  xpReward: number;
  check: (userId: string) => Promise<boolean>;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    key: "first_steps",
    name: "First Steps",
    description: "Create your account and start your journey",
    icon: "footprints",
    category: "explorer",
    xpReward: 25,
    check: async () => true, // always true — awarded on registration
  },
  {
    key: "first_journal",
    name: "First Words",
    description: "Write your first journal entry",
    icon: "pencil",
    category: "journal",
    xpReward: 10,
    check: async (userId) => {
      const count = await prisma.journal.count({ where: { userId } });
      return count >= 1;
    },
  },
  {
    key: "7_day_streak",
    name: "Week Warrior",
    description: "Maintain a 7-day streak",
    icon: "flame",
    category: "habits",
    xpReward: 50,
    check: async (userId) => {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return (user?.streakDays ?? 0) >= 7;
    },
  },
  {
    key: "30_day_streak",
    name: "Monthly Master",
    description: "Maintain a 30-day streak",
    icon: "zap",
    category: "habits",
    xpReward: 200,
    check: async (userId) => {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return (user?.streakDays ?? 0) >= 30;
    },
  },
  {
    key: "100_habits",
    name: "Habit Centurion",
    description: "Complete 100 habit logs",
    icon: "100",
    category: "habits",
    xpReward: 100,
    check: async (userId) => {
      const count = await prisma.habitLog.count({ where: { userId } });
      return count >= 100;
    },
  },
  {
    key: "note_master",
    name: "Note Master",
    description: "Create 50 notes",
    icon: "book",
    category: "productivity",
    xpReward: 75,
    check: async (userId) => {
      const count = await prisma.note.count({ where: { userId } });
      return count >= 50;
    },
  },
  {
    key: "goal_crusher",
    name: "Goal Crusher",
    description: "Complete 10 goals",
    icon: "target",
    category: "productivity",
    xpReward: 150,
    check: async (userId) => {
      const count = await prisma.goal.count({
        where: { userId, status: "COMPLETED" },
      });
      return count >= 10;
    },
  },
  {
    key: "power_user",
    name: "Power User",
    description: "Reach level 10",
    icon: "crown",
    category: "explorer",
    xpReward: 500,
    check: async (userId) => {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return (user?.level ?? 0) >= 10;
    },
  },
];

/**
 * Get all achievements for a user, both earned and unearned.
 */
export async function getAchievementsForUser(userId: string) {
  const earned = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
  });

  const earnedKeys = new Set(earned.map((ea) => ea.achievement.key));

  return ACHIEVEMENT_DEFINITIONS.map((def) => {
    const earnedRecord = earned.find(
      (ea) => ea.achievement.key === def.key
    );
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      icon: def.icon,
      category: def.category,
      xpReward: def.xpReward,
      earned: earnedKeys.has(def.key),
      earnedAt: earnedRecord?.earnedAt ?? null,
    };
  });
}

/**
 * Check all achievement conditions for a user and award any newly earned ones.
 * Returns the list of newly earned achievement keys with their XP rewards.
 */
export async function checkAndAwardAchievements(
  userId: string
): Promise<{ key: string; xpAwarded: number }[]> {
  const earned = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
  });

  const earnedKeys = new Set(earned.map((ea) => ea.achievement.key));

  const newlyEarned: { key: string; xpReward: number }[] = [];

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (earnedKeys.has(def.key)) continue;

    const conditionMet = await def.check(userId);
    if (conditionMet) {
      newlyEarned.push({ key: def.key, xpReward: def.xpReward });
    }
  }

  if (newlyEarned.length > 0) {
    for (const achievement of newlyEarned) {
      const def = ACHIEVEMENT_DEFINITIONS.find(
        (d) => d.key === achievement.key
      )!;

      // Upsert the achievement definition into the database
      const achievementRecord = await prisma.achievement.upsert({
        where: { key: achievement.key },
        update: {},
        create: {
          key: achievement.key,
          name: def.name,
          description: def.description,
          icon: def.icon,
          category: def.category,
          xpReward: achievement.xpReward,
        },
      });

      // Create the user-achievement link
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId: achievementRecord.id,
        },
      });

      // Award bonus XP
      await addXp(userId, achievement.xpReward, `achievement:${achievement.key}`);
    }
  }

  return newlyEarned.map((a) => ({
    key: a.key,
    xpAwarded: a.xpReward,
  }));
}