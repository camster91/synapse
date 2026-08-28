import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("upload capacity is reserved atomically before writing a file", async () => {
  const quota = await readFile("src/lib/upload-quota.ts", "utf8");
  const route = await readFile("src/app/api/upload/route.ts", "utf8");

  assert.match(quota, /uploadBytes:\s*\{ lte: MAX_USER_UPLOAD_BYTES - requestedBytes \}/);
  assert.match(quota, /uploadBytes:\s*\{ increment: requestedBytes \}/);
  assert.ok(
    route.indexOf("reserveUploadCapacity") < route.indexOf("saved = await saveFile"),
    "capacity must be reserved before the filesystem write"
  );
  assert.match(route, /Upload storage limit reached \(512 MB per account\)/);
});

test("failed uploads compensate both quota and filesystem state", async () => {
  const route = await readFile("src/app/api/upload/route.ts", "utf8");

  assert.match(route, /Promise\.allSettled\(\[/);
  assert.match(route, /releaseUploadCapacity\(session\.user\.id, file\.size\)/);
  assert.match(route, /deleteFile\(saved\.url\)/);
});

test("attachment deletion workflows release accounted bytes", async () => {
  for (const routePath of [
    "src/app/api/attachments/[id]/route.ts",
    "src/app/api/notes/[id]/route.ts",
    "src/app/api/todos/[id]/route.ts",
    "src/app/api/calendar/[id]/route.ts",
    "src/app/api/inbox/[id]/route.ts",
  ]) {
    const route = await readFile(routePath, "utf8");
    assert.match(route, /releaseUploadCapacity\(/, `${routePath} must release quota`);
  }
});

test("the migration backfills quota accounting from existing attachments", async () => {
  const migration = await readFile(
    "prisma/migrations/20260828220000_add_upload_quota/migration.sql",
    "utf8"
  );

  assert.match(migration, /ADD COLUMN "uploadBytes" BIGINT NOT NULL DEFAULT 0/);
  assert.match(migration, /SUM\("sizeBytes"\)/);
  assert.match(migration, /GROUP BY "userId"/);
});
