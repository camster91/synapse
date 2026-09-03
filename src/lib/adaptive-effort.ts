import { prisma } from "@/lib/prisma";

interface EffortRow {
  id: string;
  estimatedMinutes: number | null;
  minimumMinutes: number | null;
  deferredUntil: Date | null;
}

export interface AdaptiveEffortMetadata {
  estimatedMinutes: number | null;
  minimumMinutes: number | null;
  deferredUntil: string | null;
}

export async function loadAdaptiveEffortMetadata(userId: string, itemIds: string[]) {
  if (itemIds.length === 0) return new Map<string, AdaptiveEffortMetadata>();

  const rows = await prisma.$queryRaw<EffortRow[]>`
    SELECT id, "estimatedMinutes", "minimumMinutes", "deferredUntil"
    FROM todos
    WHERE "userId" = ${userId} AND id = ANY(${itemIds}::text[])
  `;

  return new Map(
    rows.map((row) => [
      row.id,
      {
        estimatedMinutes: row.estimatedMinutes,
        minimumMinutes: row.minimumMinutes,
        deferredUntil: row.deferredUntil?.toISOString() ?? null,
      },
    ]),
  );
}
