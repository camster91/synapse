ALTER TABLE "users"
ADD COLUMN "uploadBytes" BIGINT NOT NULL DEFAULT 0;

UPDATE "users" AS u
SET "uploadBytes" = attachment_totals.total
FROM (
  SELECT "userId", COALESCE(SUM("sizeBytes"), 0)::BIGINT AS total
  FROM "attachments"
  GROUP BY "userId"
) AS attachment_totals
WHERE u.id = attachment_totals."userId";
