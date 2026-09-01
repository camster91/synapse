import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

type ActionStatus = "PENDING" | "APPLIED" | "REJECTED" | "UNDONE" | "EXPIRED";

export function summarizeAiActionMetrics(statuses: ActionStatus[]) {
  const count = (status: ActionStatus) => statuses.filter((value) => value === status).length;
  const applied = count("APPLIED");
  const undone = count("UNDONE");
  const rejected = count("REJECTED");
  const decided = applied + undone + rejected;
  const confirmed = applied + undone;
  const percent = (numerator: number, denominator: number) =>
    denominator === 0 ? null : Number(((numerator / denominator) * 100).toFixed(1));

  return {
    generatedAt: new Date().toISOString(),
    privacy: "Consented aggregate counts only; no account identifiers, proposal text, or task content.",
    proposals: statuses.length,
    pending: count("PENDING"),
    expired: count("EXPIRED"),
    decided,
    confirmed,
    rejected,
    undone,
    confirmationRatePercent: percent(confirmed, decided),
    undoRateAmongConfirmedPercent: percent(undone, confirmed),
    interpretation: "Observed product decisions only; this does not replace the representative AI quality evaluation set.",
  };
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const proposals = await prisma.aiActionProposal.findMany({
      where: { user: { productAnalyticsConsent: true } },
      select: { status: true },
    });
    console.log(JSON.stringify(summarizeAiActionMetrics(proposals.map(({ status }) => status)), null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("ai-action-metrics.ts")) {
  main().catch(() => {
    console.error("[ai-action-metrics] aggregate report failed");
    process.exitCode = 1;
  });
}
