export type PlanningCapacity = "low" | "normal" | "high";
export type PlanningAction = "keep" | "move" | "drop";

export type PlanningReasonCode =
  | "due_soon"
  | "high_priority"
  | "goal_linked"
  | "fits_remaining_time"
  | "insufficient_time"
  | "low_capacity"
  | "unknown_effort"
  | "lower_relevance";

export interface PlanningItem {
  id: string;
  priority: number;
  dueAt?: string | null;
  estimatedMinutes?: number | null;
  goalId?: string | null;
  completed?: boolean;
  scheduledAt?: string | null;
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

function hoursUntil(now: Date, dueAt?: string | null) {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  return (due.getTime() - now.getTime()) / 3_600_000;
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
    if (reasons.includes("due_soon")) return "Keep this because its deadline is close and it still fits the revised day.";
    if (reasons.includes("high_priority")) return "Keep this because it is one of the highest-priority remaining items.";
    if (reasons.includes("goal_linked")) return "Keep this because it directly advances an active goal and still fits.";
    return "Keep this because it fits the remaining time better than lower-ranked work.";
  }

  if (action === "move") {
    if (reasons.includes("unknown_effort")) return "Move this because its effort is unknown and Synapse cannot safely claim it fits.";
    if (reasons.includes("low_capacity")) return "Move this to protect the most important work within your reduced capacity.";
    return "Move this because the revised day does not have enough reliable capacity for it.";
  }

  return "Remove this from Today because higher-value work already consumes the remaining capacity.";
}

export function buildAdaptivePlan(snapshot: PlanningSnapshot): PlanningProposal {
  const now = new Date(snapshot.now);
  if (Number.isNaN(now.getTime())) throw new Error("Invalid planning snapshot time");

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

    if (candidate.effort === null) {
      const action: PlanningAction = reasons.includes("due_soon") || reasons.includes("high_priority") ? "keep" : "move";
      const reasonCodes = action === "keep" ? [...reasons, "unknown_effort"] : [...reasons, "unknown_effort"];
      recommendations.push({
        itemId: candidate.item.id,
        action,
        reasonCodes,
        explanation: explain(action, reasonCodes),
        score: candidate.score,
      });
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

    const important = reasons.includes("due_soon") || reasons.includes("high_priority");
    const action: PlanningAction = important ? "move" : "drop";
    const reasonCodes: PlanningReasonCode[] = [
      ...reasons,
      "insufficient_time",
      ...(snapshot.capacity === "low" ? (["low_capacity"] as PlanningReasonCode[]) : []),
      ...(important ? [] : (["lower_relevance"] as PlanningReasonCode[])),
    ];
    recommendations.push({
      itemId: candidate.item.id,
      action,
      reasonCodes,
      explanation: explain(action, reasonCodes),
      score: candidate.score,
    });
  }

  const noChange = recommendations.every((recommendation) => recommendation.action === "keep");

  return { effectiveMinutes, recommendations, noChange };
}
