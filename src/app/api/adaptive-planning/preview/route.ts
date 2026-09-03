import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAdaptiveProposal } from "@/lib/adaptive-proposals";
import { signAdaptiveConfirmation } from "@/lib/adaptive-token";
import { loadAdaptiveEffortMetadata } from "@/lib/adaptive-effort";
import type { PlanningSnapshot } from "@/lib/adaptive-planning";

const inputSchema = z.object({
  remainingMinutes: z.number().int().min(0).max(24 * 60),
  capacity: z.enum(["low", "normal", "high"]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid adaptation request" }, { status: 400 });
  }

  const userId = session.user.id;
  const now = new Date();
  const horizon = new Date(now.getTime() + parsed.data.remainingMinutes * 60_000);

  const [todos, events] = await Promise.all([
    prisma.todo.findMany({
      where: {
        userId,
        status: { in: ["INBOX", "TODO", "IN_PROGRESS"] },
        OR: [
          { scheduledAt: { lte: horizon } },
          { dueDate: { lte: horizon } },
          { scheduledAt: null, dueDate: null, priority: { gte: 3 } },
        ],
      },
      orderBy: [{ priority: "desc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        priority: true,
        dueDate: true,
        scheduledAt: true,
        completedAt: true,
        goalId: true,
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        startAt: { lt: horizon },
        OR: [{ endAt: null }, { endAt: { gt: now } }],
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const effort = await loadAdaptiveEffortMetadata(userId, todos.map((todo) => todo.id));
  const visibleTodos = todos.filter((todo) => {
    const deferredUntil = effort.get(todo.id)?.deferredUntil;
    return !deferredUntil || new Date(deferredUntil).getTime() <= now.getTime();
  });

  const calendarBusyMinutes = events.reduce((total, event) => {
    const start = Math.max(now.getTime(), event.startAt.getTime());
    const end = Math.min(horizon.getTime(), (event.endAt ?? event.startAt).getTime());
    return total + Math.max(0, Math.round((end - start) / 60_000));
  }, 0);

  const snapshot: PlanningSnapshot = {
    now: now.toISOString(),
    remainingMinutes: parsed.data.remainingMinutes,
    capacity: parsed.data.capacity,
    calendarBusyMinutes,
    items: visibleTodos.map((todo) => ({
      id: todo.id,
      priority: todo.priority,
      dueAt: todo.dueDate?.toISOString() ?? null,
      estimatedMinutes: effort.get(todo.id)?.estimatedMinutes ?? null,
      goalId: todo.goalId,
      completed: Boolean(todo.completedAt),
      scheduledAt: todo.scheduledAt?.toISOString() ?? null,
    })),
  };

  const proposal = createAdaptiveProposal(snapshot);
  const confirmationToken = signAdaptiveConfirmation({
    userId,
    proposalId: proposal.id,
    snapshotHash: proposal.snapshotHash,
    snapshot,
    expiresAt: proposal.expiresAt,
  });

  return NextResponse.json(
    { proposal, confirmationToken },
    { headers: { "Cache-Control": "no-store" } },
  );
}
