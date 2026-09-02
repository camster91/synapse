import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production startup reconciles uploads after migrations", async () => {
  for (const composePath of ["docker-compose.prod.yml", "docker-compose.vps.yml"]) {
    const compose = await readFile(composePath, "utf8");
    assert.match(
      compose,
      /prisma migrate deploy && npm run uploads:reconcile && node server\.js/
    );
  }
});

test("reconciliation fails closed before deleting untracked files", async () => {
  const script = await readFile("scripts/reconcile-uploads.ts", "utf8");
  const query = script.indexOf("prisma.attachment.findMany");
  const removal = script.indexOf("removedOrphans++");

  assert.ok(query >= 0 && query < removal);
  assert.match(script, /referenced\.has\(entry\.name\)/);
  assert.match(script, /UPDATE "users" AS u/);
  assert.match(script, /SUM\(attachments\."sizeBytes"\)/);
});

test("the production image contains the reconciliation script", async () => {
  const dockerfile = await readFile("Dockerfile", "utf8");
  assert.match(dockerfile, /COPY --from=builder \/app\/scripts \.\/scripts/);
});
