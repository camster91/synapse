import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildAdaptiveMutations,
  buildUndoState,
  type AdaptiveAcceptedRecommendation,
  type AdaptiveTodoState,
  type AdaptiveTodoStatus,
} from "@/lib/adaptive-mutations";

const todoStateSelect = {
  id: true,
  status: true,
  priority: true,
  dueDate: true,
  scheduledAt: true,
  deferredUntil: true,
  estimatedMinutes: true,
  minimumMinutes: true,
  updatedAt: true,
} satisfies Prisma.TodoSelect;

type TodoStateRow = Prisma.TodoGetPayload<{ select: typeof todoStateSelect }>;

const todoStateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["INBOX", "TODO", "IN_PROGRESS", "DONE", "CANCELLED", "SNOOZED"]),
  priority: z.number().int(),
  dueDate: z.string().datetime().nullable(),
  scheduledAt: z.string().datetime().nullable(),
  deferredUntil: z.string().datetime().nullable(),
  estimatedMinutes: z.number().int().positive().nullable(),
  minimumMinutes: z.number().int().positive().nullable(),
  updatedAt: z.string().datetime(),
});

function serializeTodo(row: TodoStateRow): AdaptiveTodoState {
  return {
    id: row.id,
    status: row.status as AdaptiveTodoStatus,
    priority: row.priority,
    dueDate: row.dueDate?.toISOString() ?? null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    deferredUntil: row.deferredUntil?.toISOString() ?? null,
    estimatedMinutes: row.estimatedMinutes,
    minimumMinutes: row.minimumMinutes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseState(value: unknown) {
  return z.array(todoStateSchema).parse(value) as AdaptiveTodoState[];
}

function hasPrismaCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export async function loadAdaptiveTodoStates(userId: string, itemIds: string[]) {
  if (itemIds.length === 0) return [];
  const rows = await prisma.todo.findMany({
    where: { userId, id: { in: itemIds } },
    select: todoStateSelect,
  });
  return rows.map(serializeTodo);
}

export async function applyAdaptiveChange(input: {
  userId: string;
  proposalId: string;
  recommendations: AdaptiveAcceptedRecommendation[];
  undoWindowMinutes?: number;
}) {
  if (input.recommendations.length === 0) {
    return { changeId: null, duplicate: false, appliedCount: 0, undoExpiresAt: null };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.adaptivePlanChange.findUnique({
        where: { proposalId: input.proposalId },
        select: { id: true, userId: true, afterState: true, undoExpiresAt: true },
      });
      if (existing) {
        if (existing.userId !== input.userId) throw new Error("Adaptive proposal conflict");
        return {
          changeId: existing.id,
          duplicate: true,
          appliedCount: parseState(existing.afterState).length,
          undoExpiresAt: existing.undoExpiresAt.toISOString(),
        };
      }

      const rows = await tx.todo.findMany({
        where: {
          userId: input.userId,
          id: { in: input.recommendations.map((recommendation) => recommendation.itemId) },
        },
        select: todoStateSelect,
      });
      const current = rows.map(serializeTodo);
      const mutations = buildAdaptiveMutations(current, input.recommendations);
      const appliedAt = new Date();
      const undoExpiresAt = new Date(
        appliedAt.getTime() + (input.undoWindowMinutes ?? 10) * 60_000,
      );
      const resolvedMutations = mutations.map((mutation) => ({
        ...mutation,
        after: { ...mutation.after, updatedAt: appliedAt.toISOString() },
      }));

      for (const mutation of resolvedMutations) {
        const updated = await tx.todo.updateMany({
          where: {
            id: mutation.itemId,
            userId: input.userId,
            updatedAt: new Date(mutation.before.updatedAt),
          },
          data: {
            scheduledAt: mutation.after.scheduledAt ? new Date(mutation.after.scheduledAt) : null,
            deferredUntil: mutation.after.deferredUntil ? new Date(mutation.after.deferredUntil) : null,
            estimatedMinutes: mutation.after.estimatedMinutes,
            updatedAt: appliedAt,
          },
        });
        if (updated.count !== 1) throw new Error("Adaptive plan changed before apply");
      }

      const change = await tx.adaptivePlanChange.create({
        data: {
          userId: input.userId,
          proposalId: input.proposalId,
          beforeState: resolvedMutations.map((mutation) => mutation.before) as unknown as Prisma.InputJsonValue,
          afterState: resolvedMutations.map((mutation) => mutation.after) as unknown as Prisma.InputJsonValue,
          appliedAt,
          undoExpiresAt,
        },
        select: { id: true },
      });

      return {
        changeId: change.id,
        duplicate: false,
        appliedCount: resolvedMutations.length,
        undoExpiresAt: undoExpiresAt.toISOString(),
      };
    });
  } catch (error) {
    if (hasPrismaCode(error, "P2002")) {
      const existing = await prisma.adaptivePlanChange.findFirst({
        where: { proposalId: input.proposalId, userId: input.userId },
        select: { id: true, afterState: true, undoExpiresAt: true },
      });
      if (existing) {
        return {
          changeId: existing.id,
          duplicate: true,
          appliedCount: parseState(existing.afterState).length,
          undoExpiresAt: existing.undoExpiresAt.toISOString(),
        };
      }
    }
    throw error;
  }
}

export async function undoAdaptiveChange(input: { userId: string; changeId: string; now?: Date }) {
  const now = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const change = await tx.adaptivePlanChange.findFirst({
      where: { id: input.changeId, userId: input.userId },
      select: {
        id: true,
        beforeState: true,
        afterState: true,
        undoExpiresAt: true,
        undoneAt: true,
      },
    });
    if (!change) throw new Error("Adaptive change not found");
    if (change.undoneAt) return { alreadyUndone: true };
    if (change.undoExpiresAt.getTime() <= now.getTime()) throw new Error("Adaptive undo expired");

    const before = parseState(change.beforeState);
    const after = parseState(change.afterState);
    const beforeById = new Map(before.map((state) => [state.id, state]));
    const afterById = new Map(after.map((state) => [state.id, state]));
    if (beforeById.size !== before.length || afterById.size !== after.length || before.length !== after.length) {
      throw new Error("Adaptive undo state is incomplete");
    }

    const rows = await tx.todo.findMany({
      where: { userId: input.userId, id: { in: before.map((state) => state.id) } },
      select: todoStateSelect,
    });
    const currentById = new Map(rows.map(serializeTodo).map((state) => [state.id, state]));

    for (const prior of before) {
      const applied = afterById.get(prior.id);
      const current = currentById.get(prior.id);
      if (!applied || !current) throw new Error("Adaptive undo state is incomplete");
      const undo = buildUndoState({ itemId: prior.id, before: prior, after: applied }, current);
      const updated = await tx.todo.updateMany({
        where: {
          id: prior.id,
          userId: input.userId,
          updatedAt: new Date(current.updatedAt),
        },
        data: {
          status: undo.status,
          priority: undo.priority,
          dueDate: undo.dueDate ? new Date(undo.dueDate) : null,
          scheduledAt: undo.scheduledAt ? new Date(undo.scheduledAt) : null,
          deferredUntil: undo.deferredUntil ? new Date(undo.deferredUntil) : null,
          estimatedMinutes: undo.estimatedMinutes,
          minimumMinutes: undo.minimumMinutes,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) throw new Error("Adaptive undo conflicts with newer edits");
    }

    const marked = await tx.adaptivePlanChange.updateMany({
      where: { id: change.id, userId: input.userId, undoneAt: null },
      data: { undoneAt: now },
    });
    if (marked.count !== 1) throw new Error("Adaptive change was already undone");
    return { alreadyUndone: false };
  });
}
