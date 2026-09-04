import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { requireSafeTarget } from "../scripts/authenticated-lifecycle-smoke";

const smoke = readFileSync("scripts/authenticated-lifecycle-smoke.ts", "utf8");
const operations = readFileSync("OPERATIONS.md", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("authenticated lifecycle smoke is explicit, complete, and remote-safe", () => {
  assert.equal(packageJson.scripts["smoke:lifecycle"], "tsx scripts/authenticated-lifecycle-smoke.ts");
  assert.match(smoke, /LIFECYCLE_SMOKE_CONFIRM/);
  assert.match(smoke, /create-and-delete-disposable-account/);
  assert.match(smoke, /LIFECYCLE_SMOKE_ALLOW_REMOTE/);
  assert.match(smoke, /anonymous export did not return 401/);
  assert.match(smoke, /portable export contract failed/);
  assert.match(smoke, /wrong-password deletion did not return 403/);
  assert.match(smoke, /deleted credentials still authenticate/);
  assert.match(smoke, /database still contains disposable account or authentication rows/);
  assert.match(smoke, /verification_tokens where identifier in/);
  assert.match(smoke, /sessions where "userId" = \$1/);
  assert.match(operations, /Authenticated lifecycle smoke/);
  assert.match(operations, /explicit release\/operator approval/);
});

test("local lifecycle bypasses only its disposable marker under the explicit sink contract", () => {
  assert.match(smoke, /locallyVerifyDisposableAccount/);
  assert.match(smoke, /process\.env\.EMAIL_PROVIDER !== "local-sink"/);
  assert.match(smoke, /AUTH_EMAIL_LOCAL_SINK !== REQUIRED_LOCAL_SINK_CONFIRMATION/);
  assert.match(smoke, /delete from verification_tokens where identifier = \$1/);
  assert.match(smoke, /verify:\$\{userId\}/);
  assert.match(smoke, /remote lifecycle smoke cannot bypass email verification/);
  assert.match(smoke, /loopback-disposable-db-marker-bypass-not-external-email-proof/);
  assert.match(operations, /does not satisfy #60/);
  assert.match(operations, /EMAIL_PROVIDER='local-sink'/);
  assert.match(operations, /AUTH_EMAIL_LOCAL_SINK='disposable-lifecycle-only'/);
  assert.match(operations, /Never use the local sink on an approved beta\/public hostname/);
});

test("lifecycle smoke fails closed without confirmation and remote authorization", () => {
  const priorConfirmation = process.env.LIFECYCLE_SMOKE_CONFIRM;
  const priorRemote = process.env.LIFECYCLE_SMOKE_ALLOW_REMOTE;
  try {
    delete process.env.LIFECYCLE_SMOKE_CONFIRM;
    delete process.env.LIFECYCLE_SMOKE_ALLOW_REMOTE;
    assert.throws(() => requireSafeTarget(new URL("http://127.0.0.1:3000")), /LIFECYCLE_SMOKE_CONFIRM/);

    process.env.LIFECYCLE_SMOKE_CONFIRM = "create-and-delete-disposable-account";
    assert.doesNotThrow(() => requireSafeTarget(new URL("http://127.0.0.1:3000")));
    assert.throws(() => requireSafeTarget(new URL("https://example.com")), /ALLOW_REMOTE/);

    process.env.LIFECYCLE_SMOKE_ALLOW_REMOTE = "true";
    assert.doesNotThrow(() => requireSafeTarget(new URL("https://example.com")));
  } finally {
    if (priorConfirmation === undefined) delete process.env.LIFECYCLE_SMOKE_CONFIRM;
    else process.env.LIFECYCLE_SMOKE_CONFIRM = priorConfirmation;
    if (priorRemote === undefined) delete process.env.LIFECYCLE_SMOKE_ALLOW_REMOTE;
    else process.env.LIFECYCLE_SMOKE_ALLOW_REMOTE = priorRemote;
  }
});
