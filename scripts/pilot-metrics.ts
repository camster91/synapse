import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

export type PilotMetricUser = {
  createdAt: Date;
  events: Array<{
    name: "FIRST_PLAN_CREATED" | "TODAY_OPENED" | "EXPORT_SUCCEEDED";
    dayKey: string;
    occurredAt: Date;
  }>;
};

export function summarizePilotMetrics(users: PilotMetricUser[]) {
  let activatedWithinTenMinutes = 0;
  let retainedEightOfFourteenDays = 0;

  for (const user of users) {
    const activationDeadline = user.createdAt.getTime() + 10 * 60 * 1000;
    if (
      user.events.some(
        (event) =>
          event.name === "FIRST_PLAN_CREATED" &&
          event.occurredAt.getTime() >= user.createdAt.getTime() &&
          event.occurredAt.getTime() <= activationDeadline
      )
    ) {
      activatedWithinTenMinutes++;
    }

    const retentionDeadline = user.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000;
    const engagedDays = new Set(
      user.events
        .filter(
          (event) =>
            event.name === "TODAY_OPENED" &&
            event.occurredAt.getTime() >= user.createdAt.getTime() &&
            event.occurredAt.getTime() < retentionDeadline
        )
        .map((event) => event.dayKey)
    ).size;
    if (engagedDays >= 8) retainedEightOfFourteenDays++;
  }

  const percent = (count: number) =>
    users.length === 0 ? null : Number(((count / users.length) * 100).toFixed(1));

  return {
    generatedAt: new Date().toISOString(),
    privacy: "Aggregate counts only; no account identifiers or activity content.",
    consentedParticipants: users.length,
    activation: {
      definition: "First plan created within 10 minutes of account creation",
      count: activatedWithinTenMinutes,
      percent: percent(activatedWithinTenMinutes),
      targetPercent: 80,
    },
    fourteenDayEngagedRetention: {
      definition: "Today opened on at least 8 distinct days in the first 14 days",
      count: retainedEightOfFourteenDays,
      percent: percent(retainedEightOfFourteenDays),
      targetPercent: 60,
    },
    decisionReadiness: users.length >= 5 ? "pilot-threshold-reached" : "insufficient-participants",
  };
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const users = await prisma.user.findMany({
      where: { productAnalyticsConsent: true },
      select: {
        createdAt: true,
        productEvents: {
          select: { name: true, dayKey: true, occurredAt: true },
          orderBy: { occurredAt: "asc" },
        },
      },
    });
    console.log(
      JSON.stringify(
        summarizePilotMetrics(
          users.map((user) => ({
            createdAt: user.createdAt,
            events: user.productEvents,
          }))
        ),
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("pilot-metrics.ts")) {
  main()
    .catch(() => {
      console.error("[pilot-metrics] aggregate report failed");
      process.exitCode = 1;
    })
}
