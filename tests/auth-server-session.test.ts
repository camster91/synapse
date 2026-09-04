import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Ashbi Local CI deliberately runs this file as Synapse's authentication gate.
// Import the focused RC1 suites so that the exact PR head exercises the new
// token, delivery, revocation, data-lifecycle, and Compose contracts without a
// CI service configuration deployment.
import "./auth-account-deletion.test";
import "./auth-email-adapter-runtime.test";
import "./auth-email-change-policy.test";
import "./auth-email-lifecycle.test";
import "./auth-email-provider.test";
import "./auth-public-url-security.test";
import "./auth-rate-limit.test";
import "./authenticated-lifecycle-smoke.test";
import "./credential-session.test";
import "./production-compose-security.test";

test("server auth uses the NextAuth v4 getServerSession API", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/auth.ts"), "utf8");

  assert.match(source, /getServerSession\(authOptions\)/);
  assert.doesNotMatch(source, /NextAuth\(authOptions\)\.auth\(\)/);
  assert.match(source, /return session\?\.user\?\.id \? session : null/);
});
