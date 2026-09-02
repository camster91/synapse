import type { ProductEventName } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { localDayKey } from "@/lib/timezone";

export { localDayKey } from "@/lib/timezone";

type EventContext = {
  userId: string;
  name: ProductEventName;
  timezone: string;
  occurredAt?: Date;
};

export async function recordProductEvent(context: EventContext): Promise<void> {
  const occurredAt = context.occurredAt ?? new Date();
  const dayKey = localDayKey(occurredAt, context.timezone);
  try {
    // The consent check and insert are one database statement. This prevents a
    // stale request from recreating an event after a concurrent opt-out deletes it.
    await prisma.$executeRaw`
      INSERT INTO "product_events" ("id", "userId", "name", "dayKey", "occurredAt")
      SELECT ${crypto.randomUUID()}, ${context.userId}, ${context.name}::"ProductEventName", ${dayKey}, ${occurredAt}
      FROM "users"
      WHERE "id" = ${context.userId} AND "productAnalyticsConsent" = true
      ON CONFLICT ("userId", "name", "dayKey") DO NOTHING
    `;
  } catch {
    // Measurement must never block the customer action it observes.
    console.error("[product-metrics] fixed event could not be recorded", {
      eventName: context.name,
    });
  }
}
