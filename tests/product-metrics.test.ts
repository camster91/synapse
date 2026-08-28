import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { localDayKey } from "../src/lib/product-metrics";
import { summarizePilotMetrics } from "../scripts/pilot-metrics";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const onboardingApi = readFileSync("src/app/api/onboarding/route.ts", "utf8");
const onboardingPage = readFileSync("src/app/onboarding/page.tsx", "utf8");
const settingsApi = readFileSync("src/app/api/settings/route.ts", "utf8");
const exportApi = readFileSync("src/app/api/settings/export/route.ts", "utf8");
const metricsHelper = readFileSync("src/lib/product-metrics.ts", "utf8");

test("product measurement is explicit, minimal, and disabled by default", () => {
  assert.match(schema, /productAnalyticsConsent Boolean @default\(false\)/);
  assert.match(schema, /enum ProductEventName/);
  assert.match(schema, /@@unique\(\[userId, name, dayKey\]\)/);
  assert.doesNotMatch(schema, /ProductEvent[\s\S]*metadata/);
  assert.match(onboardingPage, /type="checkbox"/);
  assert.match(onboardingPage, /Optional and reversible in Settings/);
  assert.match(onboardingApi, /data\.productAnalyticsConsent && !data\.skip && data\.task/);
  assert.match(metricsHelper, /"productAnalyticsConsent" = true/);
  assert.match(metricsHelper, /INSERT INTO "product_events"/);
});

test("opting out atomically disables measurement and removes prior signals", () => {
  assert.match(settingsApi, /prisma\.\$transaction/);
  assert.match(settingsApi, /productAnalyticsConsent === false/);
  assert.match(settingsApi, /tx\.productEvent\.deleteMany/);
});

test("portable export discloses the consent state and fixed events", () => {
  assert.match(exportApi, /productAnalyticsConsent: true/);
  assert.match(exportApi, /productEvents/);
  assert.match(exportApi, /version: 3/);
});

test("day keys honor the account timezone and tolerate invalid zones", () => {
  const instant = new Date("2026-08-29T02:30:00.000Z");
  assert.equal(localDayKey(instant, "America/Toronto"), "2026-08-28");
  assert.equal(localDayKey(instant, "not-a-zone"), "2026-08-29");
});

test("pilot report applies the documented activation and retention rules", () => {
  const createdAt = new Date("2026-08-01T12:00:00.000Z");
  const day = (offset: number) => ({
    name: "TODAY_OPENED" as const,
    dayKey: `2026-08-${String(offset + 1).padStart(2, "0")}`,
    occurredAt: new Date(createdAt.getTime() + offset * 24 * 60 * 60 * 1000),
  });
  const summary = summarizePilotMetrics([
    {
      createdAt,
      events: [
        {
          name: "FIRST_PLAN_CREATED",
          dayKey: "2026-08-01",
          occurredAt: new Date(createdAt.getTime() + 9 * 60 * 1000),
        },
        ...Array.from({ length: 8 }, (_, index) => day(index)),
      ],
    },
    {
      createdAt,
      events: [
        {
          name: "FIRST_PLAN_CREATED",
          dayKey: "2026-08-01",
          occurredAt: new Date(createdAt.getTime() + 11 * 60 * 1000),
        },
        ...Array.from({ length: 7 }, (_, index) => day(index)),
      ],
    },
  ]);

  assert.equal(summary.activation.count, 1);
  assert.equal(summary.activation.percent, 50);
  assert.equal(summary.fourteenDayEngagedRetention.count, 1);
  assert.equal(summary.fourteenDayEngagedRetention.percent, 50);
  assert.equal(summary.decisionReadiness, "insufficient-participants");
  assert.doesNotMatch(JSON.stringify(summary), /userId|email|name/);
});
