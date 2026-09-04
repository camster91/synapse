import { loadAdaptivePlanningContext } from "@/lib/adaptive-context";
import type { PlanningSnapshot } from "@/lib/adaptive-planning";

export async function rebuildAdaptiveSnapshot(userId: string, original: PlanningSnapshot) {
  const originalNow = new Date(original.now);
  if (Number.isNaN(originalNow.getTime())) throw new Error("Invalid planning snapshot");

  const { snapshot } = await loadAdaptivePlanningContext({
    userId,
    now: originalNow,
    remainingMinutes: original.remainingMinutes,
    capacity: original.capacity,
  });
  return snapshot;
}
