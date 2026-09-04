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
  assert.match(smoke, /EMAIL_PROVIDER !== "file"/);
  assert.match(smoke, /AUTH_EMAIL_FILE_DIR/);
  assert.match(smoke, /anonymous export did not return 401/);
  assert.match(smoke, /verification token replay was not denied/);
  assert.match(smoke, /password reset token replay was not denied/);
  assert.match(smoke, /pre-reset session remained authenticated/);
  assert.match(smoke, /old password still authenticated after reset/);
  assert.match(smoke, /new password did not authenticate after reset/);
  assert.match(smoke, /portable export contract failed/);
  assert.match(smoke, /wrong-password deletion did not return 403/);
  assert.match(smoke, /deleted credentials still authenticate/);
  assert.match(smoke, /database still contains disposable account rows/);
  assert.match(operations, /Authenticated lifecycle smoke/);
  assert.match(operations, /requires explicit release\/operator approval/);
  assert.match(operations, /EMAIL_PROVIDER=file/);
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
