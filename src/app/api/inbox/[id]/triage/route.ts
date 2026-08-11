import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const triageSchema = z.object({
  destination: z.enum(["todo", "note", "archive"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { destination } = triageSchema.parse(await request.json());
    const { id } = await params;

    const result = await prisma.$transaction(async (tx) => {
      const inboxItem = await tx.inboxItem.findFirst({
        where: { id, userId: session.user.id, processed: false },
      });
      if (!inboxItem) return null;

      let linkedId: string | null = null;
      if (destination === "todo") {
        const todo = await tx.todo.create({
          data: { userId: session.user.id, title: inboxItem.content, status: "INBOX" },
        });
        linkedId = todo.id;
      }
      if (destination === "note") {
        const note = await tx.note.create({
          data: { userId: session.user.id, title: inboxItem.content.slice(0, 200), content: inboxItem.content },
        });
        linkedId = note.id;
      }

      await tx.inboxItem.update({
        where: { id: inboxItem.id },
        data: { processed: true, processedAt: new Date(), linkedId },
      });
      return { destination, linkedId };
    });

    if (!result) return NextResponse.json({ error: "Inbox item not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Inbox triage error:", error);
    return NextResponse.json({ error: "Unable to triage inbox item" }, { status: 500 });
  }
}
