import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("liveness and readiness are separate cache-disabled contracts", async () => {
  const live = await readFile("src/app/api/health/route.ts", "utf8");
  const ready = await readFile("src/app/api/health/ready/route.ts", "utf8");

  assert.match(live, /status: "alive"/);
  assert.doesNotMatch(live, /\$queryRaw|access\(/);
  assert.match(live, /"Cache-Control": "no-store"/);
  assert.match(ready, /prisma\.\$queryRaw`SELECT 1`/);
  assert.match(ready, /constants\.R_OK \| constants\.W_OK/);
  assert.match(ready, /status: "not_ready"/);
  assert.match(ready, /status: 503/);
});

test("request-error instrumentation omits private request and error fields", async () => {
  const instrumentation = await readFile("src/instrumentation.ts", "utf8");

  assert.match(instrumentation, /Instrumentation\.onRequestError/);
  assert.match(instrumentation, /event: "request_error"/);
  assert.doesNotMatch(instrumentation, /request\.path|request\.headers|error\.message/);
  assert.match(instrumentation, /route: context\.routePath/);
});

test("the production image healthcheck uses readiness", async () => {
  const dockerfile = await readFile("Dockerfile", "utf8");
  assert.match(dockerfile, /HEALTHCHECK --interval=30s/);
  assert.match(dockerfile, /\/api\/health\/ready/);
});
