import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("liveness and readiness are separate cache-disabled contracts", async () => {
  const live = await readFile("src/app/api/health/route.ts", "utf8");
  const ready = await readFile("src/app/api/health/ready/route.ts", "utf8");

  assert.match(live, /status: "alive"/);
  assert.doesNotMatch(live, /\$queryRaw|access\(|emailDeliveryConfigured/);
  assert.match(live, /"Cache-Control": "no-store"/);

  assert.match(ready, /prisma\.\$queryRaw`SELECT 1`/);
  assert.match(ready, /constants\.R_OK \| constants\.W_OK/);
  assert.match(ready, /emailDeliveryConfigured\(\)/);
  assert.match(ready, /authenticationEmail: "failed"/);
  assert.match(ready, /checks\.authenticationEmail = "ok"/);
  assert.match(ready, /status: ready \? "ready" : "not_ready"/);
  assert.match(ready, /status: ready \? 200 : 503/);
  assert.match(ready, /"Cache-Control": "no-store"/);
});

test("readiness evidence identifies failed gates without exposing provider secrets", async () => {
  const ready = await readFile("src/app/api/health/ready/route.ts", "utf8");

  assert.match(ready, /event: "readiness_failed"/);
  assert.match(ready, /failedChecks: Object\.entries\(checks\)/);
  assert.doesNotMatch(ready, /RESEND_API_KEY|EMAIL_FROM|EMAIL_REPLY_TO|DATABASE_URL/);
  assert.doesNotMatch(ready, /error\.message|request\.headers|request\.body/);
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
