export type PlanningCapacity = "low" | "normal" | "high";
export type PlanningAction = "keep" | "shorten" | "move" | "drop";

export type PlanningReasonCode =
  | "due_soon"
  | "high_priority"
  | "goal_linked"
  | "fits_remaining_time"
  | "insufficient_time"
  | "low_capacity"
  | "unknown_effort"
  | "lower_relevance"
  | "minimum_viable"
  | "bounded_deferral"
  | "deadline_conflict";

export interface PlanningItem {
  id: string;
  priority: number;
  dueAt?: string | null;
  estimatedMinutes?: number | null;
  minimumMinutes?: number | null;
  goalId?: string | null;
  completed?: boolean;
  scheduledAt?: string | null;
  moveTargetAt?: string | null;
  dropUntil?: string | null;
  updatedAt?: string | null;
}

export interface PlanningSnapshot {
  now: string;
  remainingMinutes: number;
  capacity: PlanningCapacity;
  calendarBusyMinutes?: number;
  items: PlanningItem[];
}

export interface PlanningRecommendation {
  itemId: string;
  action: PlanningAction;
  reasonCodes: PlanningReasonCode[];
  explanation: string;
  score: number;
  targetScheduledAt?: string | null;
  targetDeferredUntil?: string | null;
  targetEstimatedMinutes?: number | null;
}

export interface PlanningProposal {
  effectiveMinutes: number;
  recommendations: PlanningRecommendation[];
  noChange: boolean;
}

const CAPACITY_MULTIPLIER: Record<PlanningCapacity, number> = {
  low: 0.6,
  normal: 1,
  high: 1.15,
};

function clampPriority(priority: number) {
  if (!Number.isFinite(priority)) return 0;
  return Math.max(0, Math.min(5, Math.round(priority)));
}

function validEffort(minutes: number | null | undefined) {
  return typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0
    ? Math.round(minutes)
    : null;
}

function validMinimum(item: PlanningItem, effort: number) {
  const minimum = validEffort(item.minimumMinutes);
  return minimum !== null && minimum < effort ? minimum : null;
}

function hoursUntil(now: Date, dueAt?: string | null) {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  return (due.getTime() - now.getTime()) / 3_600_000;
}

function deadlinePreventsMove(item: PlanningItem) {
  if (!item.dueAt || !item.moveTargetAt) return false;
  const due = new Date(item.dueAt);
  const target = new Date(item.moveTargetAt);
  return !Number.isNaN(due.getTime()) && !Number.isNaN(target.getTime()) && due.getTime() <= target.getTime();
}

function scoreItem(item: PlanningItem, now: Date) {
  const priority = clampPriority(item.priority);
  const dueHours = hoursUntil(now, item.dueAt);
  let score = priority * 20;

  if (dueHours !== null) {
    if (dueHours <= 0) score += 80;
    else if (dueHours <= 24) score += 60;
    else if (dueHours <= 72) score += 35;
    else if (dueHours <= 168) score += 15;
  }

  if (item.goalId) score += 12;
  if (item.scheduledAt) score += 8;
  return score;
}

function baseReasons(item: PlanningItem, now: Date): PlanningReasonCode[] {
  const reasons: PlanningReasonCode[] = [];
  const priority = clampPriority(item.priority);
  const dueHours = hoursUntil(now, item.dueAt);

  if (dueHours !== null && dueHours <= 72) reasons.push("due_soon");
  if (priority >= 4) reasons.push("high_priority");
  if (item.goalId) reasons.push("goal_linked");
  return reasons;
}

function explain(action: PlanningAction, reasons: PlanningReasonCode[]) {
  if (action === "keep") {
    if (reasons.includes("deadline_conflict")) {
      return "Keep this visible because its real deadline arrives before a safe move target, even though the revised day is over capacity.";
    }
    if (reasons.includes("unknown_effort")) {
      return "Keep this important item, but add an effort estimate before assuming anything else fits.";
    }
    if (reasons.includes("due_soon")) return "Keep this because its deadline is close and it still fits the revised day.";
    if (reasons.includes("high_priority")) return "Keep this because it is one of the highest-priority remaining items.";
    if (reasons.includes("goal_linked")) return "Keep this because it directly advances an active goal and still fits.";
    return "Keep this because it fits the remaining time better than lower-ranked work.";
  }

  if (action === "shorten") {
    return "Use the minimum version you explicitly defined so the intent still fits today.";
  }

  if (action === "move") {
    if (reasons.includes("unknown_effort")) return "Move this because its effort is unknown and Synapse cannot safely claim it fits.";
    if (reasons.includes("low_capacity")) return "Move this to protect the most important work within your reduced capacity.";
    return "Move this because the revised day does not have enough reliable capacity for it.";
  }

  return "Remove this from Today until tomorrow because higher-value work consumes the remaining capacity.";
}

export function buildAdaptivePlan(snapshot: PlanningSnapshot): PlanningProposal {
  const now = new Date(snapshot.now);
  if (Number.isNaN(now.getTime())) throw new Error("Invalid planning snapshot time");
  if (!(snapshot.capacity in CAPACITY_MULTIPLIER)) throw new Error("Invalid planning capacity");

  const remainingMinutes = Number.isFinite(snapshot.remainingMinutes)
    ? Math.max(0, Math.round(snapshot.remainingMinutes))
    : 0;
  const calendarBusyMinutes = Number.isFinite(snapshot.calendarBusyMinutes)
    ? Math.max(0, Math.round(snapshot.calendarBusyMinutes ?? 0))
    : 0;
  const effectiveMinutes = Math.max(
    0,
    Math.floor((remainingMinutes - calendarBusyMinutes) * CAPACITY_MULTIPLIER[snapshot.capacity]),
  );

  const candidates = snapshot.items
    .filter((item) => !item.completed)
    .map((item, index) => ({
      item,
      index,
      score: scoreItem(item, now),
      effort: validEffort(item.estimatedMinutes),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index || a.item.id.localeCompare(b.item.id));

  let available = effectiveMinutes;
  const recommendations: PlanningRecommendation[] = [];

  for (const candidate of candidates) {
    const reasons = baseReasons(candidate.item, now);
    const important = reasons.includes("due_soon") || reasons.includes("high_priority");

    if (candidate.effort === null) {
      const deadlineConflict = deadlinePreventsMove(candidate.item);
      if ((important && available > 0) || deadlineConflict) {
        const reasonCodes: PlanningReasonCode[] = [
          ...reasons,
          "unknown_effort",
          ...(deadlineConflict ? (["deadline_conflict"] as PlanningReasonCode[]) : []),
        ];
        recommendations.push({
          itemId: candidate.item.id,
          action: "keep",
          reasonCodes,
          explanation: explain("keep", reasonCodes),
          score: candidate.score,
        });
        available = 0;
      } else {
        const reasonCodes: PlanningReasonCode[] = [...reasons, "unknown_effort", "insufficient_time"];
        recommendations.push({
          itemId: candidate.item.id,
          action: "move",
          reasonCodes,
          explanation: explain("move", reasonCodes),
          score: candidate.score,
          targetScheduledAt: candidate.item.moveTargetAt ?? null,
        });
      }
      continue;
    }

    if (candidate.effort <= available) {
      available -= candidate.effort;
      const reasonCodes: PlanningReasonCode[] = [...reasons, "fits_remaining_time"];
      recommendations.push({
        itemId: candidate.item.id,
        action: "keep",
        reasonCodes,
        explanation: explain("keep", reasonCodes),
        score: candidate.score,
      });
      continue;
    }

    const minimum = validMinimum(candidate.item, candidate.effort);
    if (minimum !== null && minimum <= available) {
      available -= minimum;
      const reasonCodes: PlanningReasonCode[] = [
        ...reasons,
        "insufficient_time",
        "minimum_viable",
        ...(snapshot.capacity === "low" ? (["low_capacity"] as PlanningReasonCode[]) : []),
      ];
      recommendations.push({
        itemId: candidate.item.id,
        action: "shorten",
        reasonCodes,
        explanation: explain("shorten", reasonCodes),
        score: candidate.score,
        targetEstimatedMinutes: minimum,
      });
      continue;
    }

    if (deadlinePreventsMove(candidate.item)) {
      const reasonCodes: PlanningReasonCode[] = [
        ...reasons,
        "insufficient_time",
        "deadline_conflict",
        ...(snapshot.capacity === "low" ? (["low_capacity"] as PlanningReasonCode[]) : []),
      ];
      recommendations.push({
        itemId: candidate.item.id,
        action: "keep",
        reasonCodes,
        explanation: explain("keep", reasonCodes),
        score: candidate.score,
      });
      available = 0;
      continue;
    }

    const action: PlanningAction = important ? "move" : "drop";
    const reasonCodes: PlanningReasonCode[] = [
      ...reasons,
      "insufficient_time",
      ...(snapshot.capacity === "low" ? (["low_capacity"] as PlanningReasonCode[]) : []),
      ...(important ? [] : (["lower_relevance", "bounded_deferral"] as PlanningReasonCode[])),
    ];
    recommendations.push({
      itemId: candidate.item.id,
      action,
      reasonCodes,
      explanation: explain(action, reasonCodes),
      score: candidate.score,
      targetScheduledAt: action === "move" ? candidate.item.moveTargetAt ?? null : undefined,
      targetDeferredUntil: action === "drop" ? candidate.item.dropUntil ?? null : undefined,
    });
  }

  return {
    effectiveMinutes,
    recommendations,
    noChange: recommendations.every((recommendation) => recommendation.action === "keep"),
  };
}
