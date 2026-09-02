import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prepareActionProposal } from "@/lib/ai/tools";

const decisionSchema = z.object({
  decision: z.enum(["confirm", "reject", "undo"]),
}).strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const { decision } = decisionSchema.parse(await request.json());
    const now = new Date();

    await prisma.aiActionProposal.updateMany({
      where: {
        id,
        userId: session.user.id,
        status: "PENDING",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });

    const action = await prisma.$transaction(async (tx) => {
      const proposal = await tx.aiActionProposal.findFirst({
        where: { id, userId: session.user.id },
      });
      if (!proposal) throw new Error("ACTION_NOT_FOUND");
      if (proposal.status === "EXPIRED") throw new Error("ACTION_EXPIRED");

      if (decision === "reject") {
        if (proposal.status !== "PENDING") throw new Error("ACTION_NOT_PENDING");
        const rejected = await tx.aiActionProposal.updateMany({
          where: { id: proposal.id, userId: session.user.id, status: "PENDING" },
          data: { status: proposal.expiresAt <= now ? "EXPIRED" : "REJECTED" },
        });
        if (rejected.count !== 1) throw new Error("ACTION_NOT_PENDING");
        return tx.aiActionProposal.findUniqueOrThrow({ where: { id: proposal.id } });
      }

      if (decision === "confirm") {
        if (proposal.status !== "PENDING") throw new Error("ACTION_NOT_PENDING");
        if (proposal.expiresAt <= now) throw new Error("ACTION_EXPIRED");
        const prepared = prepareActionProposal(proposal.toolName, proposal.arguments);
        if (!prepared.success) throw new Error("ACTION_INVALID");

        const claimed = await tx.aiActionProposal.updateMany({
          where: {
            id: proposal.id,
            userId: session.user.id,
            status: "PENDING",
            expiresAt: { gt: now },
          },
          data: { status: "APPLIED", appliedAt: now },
        });
        if (claimed.count !== 1) throw new Error("ACTION_NOT_PENDING");

        const args = prepared.arguments;
        const todo = await tx.todo.create({
          data: {
            userId: session.user.id,
            title: args.title,
            description: args.description,
            priority: args.priority,
            dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
            status: args.status,
          },
        });
        const undoExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
        return tx.aiActionProposal.update({
          where: { id: proposal.id },
          data: {
            status: "APPLIED",
            appliedAt: now,
            undoExpiresAt,
            result: { todoId: todo.id, todoUpdatedAt: todo.updatedAt.toISOString() },
          },
        });
      }

      if (proposal.status !== "APPLIED") throw new Error("ACTION_NOT_APPLIED");
      if (!proposal.undoExpiresAt || proposal.undoExpiresAt <= now) throw new Error("UNDO_EXPIRED");
      const result = proposal.result as { todoId?: unknown; todoUpdatedAt?: unknown } | null;
      if (typeof result?.todoId !== "string" || typeof result.todoUpdatedAt !== "string") {
        throw new Error("UNDO_UNAVAILABLE");
      }
      const todo = await tx.todo.findFirst({
        where: { id: result.todoId, userId: session.user.id },
        select: {
          id: true,
          updatedAt: true,
          _count: { select: { attachments: true, tags: true, subtasks: true } },
        },
      });
      if (!todo) throw new Error("UNDO_UNAVAILABLE");
      if (todo.updatedAt.toISOString() !== result.todoUpdatedAt) throw new Error("ACTION_CHANGED");
      if (todo._count.attachments || todo._count.tags || todo._count.subtasks) {
        throw new Error("ACTION_CHANGED");
      }
      const claimed = await tx.aiActionProposal.updateMany({
        where: { id: proposal.id, userId: session.user.id, status: "APPLIED" },
        data: { status: "UNDONE", undoneAt: now },
      });
      if (claimed.count !== 1) throw new Error("ACTION_NOT_APPLIED");
      await tx.todo.delete({ where: { id: todo.id, userId: session.user.id } });
      return tx.aiActionProposal.findUniqueOrThrow({ where: { id: proposal.id } });
    });

    const prepared = prepareActionProposal(action.toolName, action.arguments);
    return NextResponse.json({
      action: {
        id: action.id,
        summary: action.summary,
        status: action.status,
        expiresAt: action.expiresAt,
        undoExpiresAt: action.undoExpiresAt,
        details: prepared.success ? prepared.details : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const known: Record<string, [string, number]> = {
      ACTION_NOT_FOUND: ["Action not found", 404],
      ACTION_NOT_PENDING: ["Action is no longer awaiting confirmation", 409],
      ACTION_EXPIRED: ["Action confirmation expired", 409],
      ACTION_INVALID: ["Action parameters are no longer valid", 409],
      ACTION_NOT_APPLIED: ["Action has not been applied", 409],
      UNDO_EXPIRED: ["Undo window expired", 409],
      UNDO_UNAVAILABLE: ["The created task is no longer available to undo", 409],
      ACTION_CHANGED: ["The task changed after creation and cannot be safely removed", 409],
    };
    const [message, status] = known[code] ?? ["Action could not be updated", 500];
    return NextResponse.json({ error: message }, { status });
  }
}
