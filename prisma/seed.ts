import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const adapter = new PrismaPg(new pg.Pool({ connectionString: process.env.DATABASE_URL }));
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create achievements
  const achievements = [
    { key: "first_journal", name: "Dear Diary", description: "Write your first journal entry", icon: "📔", category: "journal", xpReward: 10 },
    { key: "7_day_streak", name: "Week Warrior", description: "Maintain a 7-day streak", icon: "🔥", category: "habits", xpReward: 50 },
    { key: "30_day_streak", name: "Monthly Master", description: "Maintain a 30-day streak", icon: "💎", category: "habits", xpReward: 200 },
    { key: "100_habits", name: "Habit Centurion", description: "Complete 100 habit logs", icon: "💯", category: "habits", xpReward: 100 },
    { key: "note_master", name: "Note Master", description: "Create 50 notes", icon: "📝", category: "productivity", xpReward: 75 },
    { key: "goal_crusher", name: "Goal Crusher", description: "Complete your first goal", icon: "🏆", category: "productivity", xpReward: 100 },
    { key: "power_user", name: "Power User", description: "Reach level 10", icon: "⚡", category: "explorer", xpReward: 250 },
    { key: "inbox_zero", name: "Inbox Zero", description: "Process all inbox items", icon: "📭", category: "productivity", xpReward: 25 },
    { key: "early_bird", name: "Early Bird", description: "Log a habit before 7am", icon: "🌅", category: "habits", xpReward: 15 },
    { key: "weekend_warrior", name: "Weekend Warrior", description: "Complete habits on both Saturday and Sunday", icon: "🎉", category: "habits", xpReward: 20 },
    { key: "planner", name: "Planner", description: "Create your first calendar event", icon: "📅", category: "explorer", xpReward: 10 },
    { key: "backlinker", name: "Connected Thinker", description: "Create a note with a backlink", icon: "🔗", category: "explorer", xpReward: 30 },
    { key: "ai_conversationalist", name: "AI Conversationalist", description: "Have your first AI chat", icon: "🤖", category: "explorer", xpReward: 15 },
    { key: "todo_machine", name: "Todo Machine", description: "Complete 50 todos", icon: "✅", category: "productivity", xpReward: 75 },
    { key: "level_5", name: "Halfway There", description: "Reach level 5", icon: "⭐", category: "explorer", xpReward: 50 },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: achievement,
      create: achievement,
    });
  }

  console.log(`Created ${achievements.length} achievements`);

  // Create default plugins
  const plugins = [
    {
      name: "finance-tracker",
      displayName: "Finance Tracker",
      description: "Track expenses, budgets, and subscriptions",
      version: "1.0.0",
      author: "Synapse",
      icon: "💰",
      permissions: ["read:todos", "write:todos", "read:notes", "write:notes"],
      configSchema: {
        currency: { type: "select", label: "Currency", options: ["USD", "EUR", "GBP", "CAD"], default: "USD" },
        monthlyBudget: { type: "number", label: "Monthly Budget", default: 0 },
      },
      published: true,
    },
    {
      name: "relationship-crm",
      displayName: "Relationship CRM",
      description: "Remember birthdays, reach out reminders, and notes on conversations",
      version: "1.0.0",
      author: "Synapse",
      icon: "🤝",
      permissions: ["read:calendar", "write:calendar", "read:notes", "write:notes"],
      configSchema: {
        reminderDays: { type: "number", label: "Reminder days ahead", default: 3 },
      },
      published: true,
    },
    {
      name: "reading-list",
      displayName: "Reading List",
      description: "Track books, articles, and courses with reading progress",
      version: "1.0.0",
      author: "Synapse",
      icon: "📚",
      permissions: ["read:todos", "write:todos", "read:notes", "write:notes"],
      configSchema: {
        kindleSync: { type: "boolean", label: "Enable Kindle sync", default: false },
      },
      published: true,
    },
  ];

  for (const plugin of plugins) {
    await prisma.plugin.upsert({
      where: { name: plugin.name },
      update: {},
      create: plugin as any,
    });
  }

  console.log(`Created ${plugins.length} plugins`);
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });