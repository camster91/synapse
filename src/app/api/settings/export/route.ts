import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFileForExport } from "@/lib/upload";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Export user-owned content while deliberately excluding reusable credentials.
    const [
      user,
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
      attachments,
      installedPlugins,
      notifications,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          timezone: true,
          locale: true,
          onboardingComplete: true,
          preferredAiProvider: true,
          ollamaBaseUrl: true,
          anthropicApiKey: true,
          openaiApiKey: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
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
      prisma.attachment.findMany({ where: { userId } }),
      prisma.userPlugin.findMany({
        where: { userId },
        include: { plugin: true },
      }),
      prisma.notification.findMany({ where: { userId } }),
    ]);

    const attachmentArchive = await Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        contentBase64: await readFileForExport(attachment.url),
      }))
    );

    const exportData = {
      exportedAt: new Date().toISOString(),
      format: "synapse-portable-export",
      version: 2,
      security: {
        excluded: [
          "password hashes",
          "AI provider API keys",
          "sessions and authentication tokens",
          "push-subscription encryption keys",
        ],
      },
      profile: user
        ? {
            ...user,
            anthropicApiKey: undefined,
            openaiApiKey: undefined,
            hasAnthropicKey: Boolean(user.anthropicApiKey),
            hasOpenaiKey: Boolean(user.openaiApiKey),
          }
        : null,
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
      attachments: attachmentArchive,
      installedPlugins,
      notifications,
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
