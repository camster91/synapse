import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/account/route.ts", "utf8");
const lifecycle = readFileSync("scripts/authenticated-lifecycle-smoke.ts", "utf8");

test("account deletion removes relationless authentication tokens atomically", () => {
  assert.match(route, /await prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(route, /tx\.verificationToken\.deleteMany/);
  assert.match(route, /authTokenIdentifier\("verify", userId\)/);
  assert.match(route, /authTokenIdentifier\("reset", userId\)/);
  assert.match(route, /await tx\.user\.delete/);

  const tokenDelete = route.indexOf("tx.verificationToken.deleteMany");
  const userDelete = route.indexOf("await tx.user.delete");
  assert.ok(tokenDelete >= 0 && userDelete > tokenDelete);
});

test("account deletion preserves file rollback and avoids sensitive error logs", () => {
  assert.match(route, /await stagedFiles\.rollback\(\)/);
  assert.match(route, /await stagedFiles\.commit\(\)/);
  assert.match(route, /account_deletion_failed/);
  assert.doesNotMatch(route, /console\.error\([^\n]*error\)/);
  assert.match(route, /"Cache-Control": "no-store"/);
});

test("lifecycle smoke verifies zero remaining authentication rows", () => {
  assert.match(lifecycle, /verification_tokens/);
  assert.match(lifecycle, /'verify:' \|\| \$1/);
  assert.match(lifecycle, /'reset:' \|\| \$1/);
  assert.match(lifecycle, /database still contains disposable account rows/);
});
