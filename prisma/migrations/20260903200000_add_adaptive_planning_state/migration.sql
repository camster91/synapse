ALTER TABLE "todos"
  ADD COLUMN "estimatedMinutes" INTEGER,
  ADD COLUMN "minimumMinutes" INTEGER,
  ADD COLUMN "deferredUntil" TIMESTAMP(3);

ALTER TABLE "todos"
  ADD CONSTRAINT "todos_estimatedMinutes_positive" CHECK ("estimatedMinutes" IS NULL OR "estimatedMinutes" > 0),
  ADD CONSTRAINT "todos_minimumMinutes_positive" CHECK ("minimumMinutes" IS NULL OR "minimumMinutes" > 0),
  ADD CONSTRAINT "todos_minimumMinutes_lte_estimated" CHECK (
    "minimumMinutes" IS NULL OR "estimatedMinutes" IS NULL OR "minimumMinutes" <= "estimatedMinutes"
  );

CREATE TABLE "adaptive_plan_changes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "beforeState" JSONB NOT NULL,
  "afterState" JSONB NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "undoExpiresAt" TIMESTAMP(3) NOT NULL,
  "undoneAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "adaptive_plan_changes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "adaptive_plan_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "adaptive_plan_changes_proposalId_key" ON "adaptive_plan_changes"("proposalId");
CREATE INDEX "adaptive_plan_changes_userId_appliedAt_idx" ON "adaptive_plan_changes"("userId", "appliedAt");
CREATE INDEX "todos_deferredUntil_idx" ON "todos"("deferredUntil");
