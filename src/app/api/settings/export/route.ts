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
    // Query all user data in parallel
    const [
      habits,
      habitLogs,
      todos,
      notes,
      journals,
      goals,
      calendarEvents,
      inboxItems,
      tags,
      achievements,
      xpTransactions,
      aiConversations,
    ] = await Promise.all([
      prisma.habit.findMany({ where: { userId } }),
      prisma.habitLog.findMany({ where: { userId } }),
      prisma.todo.findMany({
        where: { userId },
        include: { tags: { select: { id: true, name: true } } },
      }),
      prisma.note.findMany({
        where: { userId },
        include: { tags: { select: { id: true, name: true } } },
      }),
      prisma.journal.findMany({
        where: { userId },
        include: { tags: { select: { id: true, name: true } } },
      }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.calendarEvent.findMany({ where: { userId } }),
      prisma.inboxItem.findMany({ where: { userId } }),
      prisma.tag.findMany({ where: { userId } }),
      prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
      }),
      prisma.xpTransaction.findMany({ where: { userId } }),
      prisma.aiConversation.findMany({
        where: { userId },
        include: { messages: true },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: 1,
      habits,
      habitLogs,
      todos,
      notes,
      journals,
      goals,
      calendarEvents,
      inboxItems,
      tags,
      achievements,
      xpTransactions,
      aiConversations,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition":
          'attachment; filename="synapse-export.json"',
      },
    });
  } catch (error) {
    console.error("Failed to export data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}