-- Product measurement is disabled by default and stores fixed event names only.
ALTER TABLE "users"
ADD COLUMN "productAnalyticsConsent" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "ProductEventName" AS ENUM (
  'FIRST_PLAN_CREATED',
  'TODAY_OPENED',
  'EXPORT_SUCCEEDED'
);

CREATE TABLE "product_events" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" "ProductEventName" NOT NULL,
  "dayKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_events_userId_name_dayKey_key"
ON "product_events"("userId", "name", "dayKey");

CREATE INDEX "product_events_name_occurredAt_idx"
ON "product_events"("name", "occurredAt");

ALTER TABLE "product_events"
ADD CONSTRAINT "product_events_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
