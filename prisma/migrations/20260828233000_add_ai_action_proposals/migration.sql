CREATE TYPE "AiActionStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED', 'UNDONE', 'EXPIRED');

CREATE TABLE "ai_action_proposals" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "arguments" JSONB NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "AiActionStatus" NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "appliedAt" TIMESTAMP(3),
  "undoExpiresAt" TIMESTAMP(3),
  "undoneAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_action_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_action_proposals_userId_status_createdAt_idx"
ON "ai_action_proposals"("userId", "status", "createdAt");

ALTER TABLE "ai_action_proposals" ADD CONSTRAINT "ai_action_proposals_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_action_proposals" ADD CONSTRAINT "ai_action_proposals_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
