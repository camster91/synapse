import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prepareActionProposal } from "@/lib/ai/tools";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId, userId: session.user.id },
    select: { id: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  await prisma.aiActionProposal.updateMany({
    where: {
      userId: session.user.id,
      conversationId,
      status: "PENDING",
      expiresAt: { lte: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  const actions = await prisma.aiActionProposal.findMany({
    where: { userId: session.user.id, conversationId },
    select: {
      id: true,
      toolName: true,
      summary: true,
      arguments: true,
      status: true,
      expiresAt: true,
      undoExpiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    actions: actions.map(({ arguments: actionArguments, ...action }) => {
      const prepared = prepareActionProposal(action.toolName, actionArguments);
      return { ...action, details: prepared.success ? prepared.details : null };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}
