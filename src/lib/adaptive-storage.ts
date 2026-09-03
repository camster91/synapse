import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  buildAdaptiveMutations,
  buildUndoState,
  type AdaptiveAcceptedRecommendation,
  type AdaptiveTodoMutation,
  type AdaptiveTodoState,
} from "@/lib/adaptive-mutations";

interface TodoRow {
  id: string;
  status: string;
  priority: number;
  dueDate: Date | null;
  scheduledAt: Date | null;
  deferredUntil: Date | null;
  estimatedMinutes: number | null;
  minimumMinutes: number | null;
  updatedAt: Date;
}

interface ChangeRow {
  id: string;
  proposalId: string;
  beforeState: unknown;
  afterState: unknown;
  undoExpiresAt: Date;
  undoneAt: Date | null;
}

function serializeTodo(row: TodoRow): AdaptiveTodoState {
  return {
    id: row.id,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate?.toISOString() ?? null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    deferredUntil: row.deferredUntil?.toISOString() ?? null,
    estimatedMinutes: row.estimatedMinutes,
    minimumMinutes: row.minimumMinutes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadAdaptiveTodoStates(userId: string, itemIds: string[]) {
  if (itemIds.length === 0) return [];
  const rows = await prisma.$queryRaw<TodoRow[]>`
    SELECT id, status::text, priority, "dueDate", "scheduledAt", "deferredUntil",
           "estimatedMinutes", "minimumMinutes", "updatedAt"
    FROM todos
    WHERE "userId" = ${userId} AND id = ANY(${itemIds}::text[])
  `;
  return rows.map(serializeTodo);
}

export async function applyAdaptiveChange(input: {
  userId: string;
  proposalId: string;
  recommendations: AdaptiveAcceptedRecommendation[];
  undoWindowMinutes?: number;
}) {
  const existing = await prisma.$queryRaw<ChangeRow[]>`
    SELECT id, "proposalId", "beforeState", "afterState", "undoExpiresAt", "undoneAt"
    FROM adaptive_plan_changes
    WHERE "proposalId" = ${input.proposalId} AND "userId" = ${input.userId}
    LIMIT 1
  `;
  if (existing[0]) return { changeId: existing[0].id, duplicate: true };

  const current = await loadAdaptiveTodoStates(
    input.userId,
    input.recommendations.map((recommendation) => recommendation.itemId),
  );
  const mutations = buildAdaptiveMutations(current, input.recommendations);
  const changeId = randomUUID();
  const undoExpiresAt = new Date(Date.now() + (input.undoWindowMinutes ?? 10) * 60_000);

  await prisma.$transaction(async (tx) => {
    const duplicate = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM adaptive_plan_changes
      WHERE "proposalId" = ${input.proposalId} AND "userId" = ${input.userId}
      LIMIT 1
      FOR UPDATE
    `;
    if (duplicate[0]) return;

    for (const mutation of mutations) {
      const result = await tx.$executeRaw`
        UPDATE todos
        SET "scheduledAt" = ${mutation.after.scheduledAt ? new Date(mutation.after.scheduledAt) : null},
            "deferredUntil" = ${mutation.after.deferredUntil ? new Date(mutation.after.deferredUntil) : null},
            "estimatedMinutes" = ${mutation.after.estimatedMinutes},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${mutation.itemId}
          AND "userId" = ${input.userId}
          AND "updatedAt" = ${new Date(mutation.before.updatedAt)}
      `;
      if (result !== 1) throw new Error("Adaptive plan changed before apply");
    }

    await tx.$executeRaw`
      INSERT INTO adaptive_plan_changes
        (id, "userId", "proposalId", "beforeState", "afterState", "undoExpiresAt", "updatedAt")
      VALUES
        (${changeId}, ${input.userId}, ${input.proposalId},
         ${JSON.stringify(mutations.map((mutation) => mutation.before))}::jsonb,
         ${JSON.stringify(mutations.map((mutation) => mutation.after))}::jsonb,
         ${undoExpiresAt}, CURRENT_TIMESTAMP)
    `;
  });

  const persisted = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM adaptive_plan_changes
    WHERE "proposalId" = ${input.proposalId} AND "userId" = ${input.userId}
    LIMIT 1
  `;
  return { changeId: persisted[0]?.id ?? changeId, duplicate: persisted[0]?.id !== changeId };
}

function parseState(value: unknown): AdaptiveTodoState[] {
  if (!Array.isArray(value)) throw new Error("Invalid adaptive change state");
  return value as AdaptiveTodoState[];
}

export async function undoAdaptiveChange(input: { userId: string; changeId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const rows = await prisma.$queryRaw<ChangeRow[]>`
    SELECT id, "proposalId", "beforeState", "afterState", "undoExpiresAt", "undoneAt"
    FROM adaptive_plan_changes
    WHERE id = ${input.changeId} AND "userId" = ${input.userId}
    LIMIT 1
  `;
  const change = rows[0];
  if (!change) throw new Error("Adaptive change not found");
  if (change.undoneAt) return { alreadyUndone: true };
  if (change.undoExpiresAt.getTime() <= now.getTime()) throw new Error("Adaptive undo expired");

  const before = parseState(change.beforeState);
  const after = parseState(change.afterState);
  const afterById = new Map(after.map((state) => [state.id, state]));
  const current = await loadAdaptiveTodoStates(input.userId, before.map((state) => state.id));
  const currentById = new Map(current.map((state) => [state.id, state]));

  const mutations: AdaptiveTodoMutation[] = before.map((prior) => {
    const applied = afterById.get(prior.id);
    const currentState = currentById.get(prior.id);
    if (!applied || !currentState) throw new Error("Adaptive undo state is incomplete");
    return { itemId: prior.id, before: prior, after: applied };
  });

  const undoStates = mutations.map((mutation) => {
    const currentState = currentById.get(mutation.itemId)!;
    return { itemId: mutation.itemId, state: buildUndoState(mutation, currentState), updatedAt: currentState.updatedAt };
  });

  await prisma.$transaction(async (tx) => {
    for (const undo of undoStates) {
      const result = await tx.$executeRaw`
        UPDATE todos
        SET status = ${undo.state.status}::"TodoStatus",
            priority = ${undo.state.priority},
            "dueDate" = ${undo.state.dueDate ? new Date(undo.state.dueDate) : null},
            "scheduledAt" = ${undo.state.scheduledAt ? new Date(undo.state.scheduledAt) : null},
            "deferredUntil" = ${undo.state.deferredUntil ? new Date(undo.state.deferredUntil) : null},
            "estimatedMinutes" = ${undo.state.estimatedMinutes},
            "minimumMinutes" = ${undo.state.minimumMinutes},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${undo.itemId} AND "userId" = ${input.userId}
          AND "updatedAt" = ${new Date(undo.updatedAt)}
      `;
      if (result !== 1) throw new Error("Adaptive undo conflicts with newer edits");
    }

    const marked = await tx.$executeRaw`
      UPDATE adaptive_plan_changes
      SET "undoneAt" = ${now}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${input.changeId} AND "userId" = ${input.userId} AND "undoneAt" IS NULL
    `;
    if (marked !== 1) throw new Error("Adaptive change was already undone");
  });

  return { alreadyUndone: false };
}
