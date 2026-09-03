import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPlanningSnapshot } from "@/lib/adaptive-proposals";
import { verifyAdaptiveConfirmation } from "@/lib/adaptive-token";
import { loadAdaptiveEffortMetadata } from "@/lib/adaptive-effort";
import type { PlanningSnapshot } from "@/lib/adaptive-planning";

const inputSchema = z.object({ confirmationToken: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid confirmation request" }, { status: 400 });
  }

  const claims = verifyAdaptiveConfirmation(parsed.data.confirmationToken, session.user.id);
  if (!claims) {
    return NextResponse.json({ error: "Confirmation expired or invalid" }, { status: 409 });
  }

  const originalNow = new Date(claims.snapshot.now);
  const horizon = new Date(originalNow.getTime() + claims.snapshot.remainingMinutes * 60_000);
  if (Number.isNaN(originalNow.getTime()) || Number.isNaN(horizon.getTime())) {
    return NextResponse.json({ error: "Invalid planning snapshot" }, { status: 409 });
  }

  const [todos, events] = await Promise.all([
    prisma.todo.findMany({
      where: {
        userId: session.user.id,
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
        userId: session.user.id,
        startAt: { lt: horizon },
        OR: [{ endAt: null }, { endAt: { gt: originalNow } }],
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const effort = await loadAdaptiveEffortMetadata(session.user.id, todos.map((todo) => todo.id));
  const visibleTodos = todos.filter((todo) => {
    const deferredUntil = effort.get(todo.id)?.deferredUntil;
    return !deferredUntil || new Date(deferredUntil).getTime() <= originalNow.getTime();
  });

  const calendarBusyMinutes = events.reduce((total, event) => {
    const start = Math.max(originalNow.getTime(), event.startAt.getTime());
    const end = Math.min(horizon.getTime(), (event.endAt ?? event.startAt).getTime());
    return total + Math.max(0, Math.round((end - start) / 60_000));
  }, 0);

  const currentSnapshot: PlanningSnapshot = {
    now: claims.snapshot.now,
    remainingMinutes: claims.snapshot.remainingMinutes,
    capacity: claims.snapshot.capacity,
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

  const currentHash = hashPlanningSnapshot(currentSnapshot);
  if (currentHash !== claims.snapshotHash) {
    return NextResponse.json(
      { valid: false, stale: true, error: "Your Today plan changed. Generate a fresh proposal." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { valid: true, stale: false, proposalId: claims.proposalId },
    { headers: { "Cache-Control": "no-store" } },
  );
}
