import type { PlanningAction } from "@/lib/adaptive-planning";

export interface AdaptiveTodoState {
  id: string;
  status: string;
  priority: number;
  dueDate: string | null;
  scheduledAt: string | null;
  deferredUntil: string | null;
  estimatedMinutes: number | null;
  minimumMinutes: number | null;
  updatedAt: string;
}

export interface AdaptiveAcceptedRecommendation {
  itemId: string;
  action: PlanningAction | "shorten";
  targetScheduledAt?: string | null;
  targetDeferredUntil?: string | null;
  targetEstimatedMinutes?: number | null;
}

export interface AdaptiveTodoMutation {
  itemId: string;
  before: AdaptiveTodoState;
  after: AdaptiveTodoState;
}

function ensurePositiveMinutes(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export function buildAdaptiveMutations(
  current: AdaptiveTodoState[],
  recommendations: AdaptiveAcceptedRecommendation[],
): AdaptiveTodoMutation[] {
  const byId = new Map(current.map((todo) => [todo.id, todo]));
  const seen = new Set<string>();
  const mutations: AdaptiveTodoMutation[] = [];

  for (const recommendation of recommendations) {
    if (seen.has(recommendation.itemId)) throw new Error("Duplicate adaptive recommendation");
    seen.add(recommendation.itemId);

    const before = byId.get(recommendation.itemId);
    if (!before) throw new Error("Adaptive recommendation references missing todo");

    let after: AdaptiveTodoState = { ...before };

    switch (recommendation.action) {
      case "keep":
        continue;
      case "move": {
        if (!recommendation.targetScheduledAt) throw new Error("Move requires a target schedule");
        const target = new Date(recommendation.targetScheduledAt);
        if (Number.isNaN(target.getTime())) throw new Error("Move target is invalid");
        after = { ...after, scheduledAt: target.toISOString(), deferredUntil: null };
        break;
      }
      case "drop": {
        if (!recommendation.targetDeferredUntil) throw new Error("Drop requires bounded Today deferral");
        const target = new Date(recommendation.targetDeferredUntil);
        if (Number.isNaN(target.getTime())) throw new Error("Drop deferral is invalid");
        after = { ...after, deferredUntil: target.toISOString() };
        break;
      }
      case "shorten": {
        const minimum = ensurePositiveMinutes(before.minimumMinutes);
        const target = ensurePositiveMinutes(recommendation.targetEstimatedMinutes);
        const estimate = ensurePositiveMinutes(before.estimatedMinutes);
        if (!minimum || !target || !estimate) throw new Error("Shorten requires explicit effort and minimum effort");
        if (minimum > estimate || target < minimum || target >= estimate) {
          throw new Error("Shorten target violates explicit effort bounds");
        }
        after = { ...after, estimatedMinutes: target };
        break;
      }
      default:
        throw new Error("Unsupported adaptive action");
    }

    mutations.push({ itemId: before.id, before: { ...before }, after });
  }

  return mutations;
}

export function canSafelyUndoMutation(
  mutation: AdaptiveTodoMutation,
  current: AdaptiveTodoState,
) {
  if (current.id !== mutation.itemId) return false;

  const mutationFields: (keyof AdaptiveTodoState)[] = [
    "status",
    "priority",
    "dueDate",
    "scheduledAt",
    "deferredUntil",
    "estimatedMinutes",
    "minimumMinutes",
  ];

  return mutationFields.every((field) => current[field] === mutation.after[field]);
}

export function buildUndoState(
  mutation: AdaptiveTodoMutation,
  current: AdaptiveTodoState,
) {
  if (!canSafelyUndoMutation(mutation, current)) {
    throw new Error("Adaptive undo conflicts with newer edits");
  }

  return {
    status: mutation.before.status,
    priority: mutation.before.priority,
    dueDate: mutation.before.dueDate,
    scheduledAt: mutation.before.scheduledAt,
    deferredUntil: mutation.before.deferredUntil,
    estimatedMinutes: mutation.before.estimatedMinutes,
    minimumMinutes: mutation.before.minimumMinutes,
  };
}
