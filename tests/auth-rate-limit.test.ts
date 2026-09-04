import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { consumeRateLimit, trustedClientIp } from "../src/lib/rate-limit";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("rate limits reject attempts after the configured budget", () => {
  const identifier = `test-${crypto.randomUUID()}@example.com`;
  const limit = {
    namespace: "unit",
    identifier,
    maxAttempts: 2,
    windowMs: 60_000,
  };

  assert.deepEqual(consumeRateLimit(limit, 1_000), { allowed: true, remaining: 1 });
  assert.deepEqual(consumeRateLimit(limit, 1_001), { allowed: true, remaining: 0 });
  assert.deepEqual(consumeRateLimit(limit, 1_002), {
    allowed: false,
    retryAfterSeconds: 60,
  });
  assert.deepEqual(consumeRateLimit(limit, 61_001), { allowed: true, remaining: 1 });
});

test("forwarded client IPs are ignored unless proxy trust is explicit", () => {
  const previous = process.env.TRUST_PROXY;
  const request = new Request("https://synapse.example/api/auth/callback/credentials", {
    headers: { "x-forwarded-for": "203.0.113.4, 10.0.0.2" },
  });

  try {
    process.env.TRUST_PROXY = "false";
    assert.equal(trustedClientIp(request), null);

    process.env.TRUST_PROXY = "true";
    assert.equal(trustedClientIp(request), "203.0.113.4");
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  }
});

test("credential routes apply account limits and avoid registration enumeration", () => {
  const register = readFileSync(
    path.join(root, "src/app/api/auth/register/route.ts"),
    "utf8"
  );
  const nextAuth = readFileSync(
    path.join(root, "src/app/api/auth/[...nextauth]/route.ts"),
    "utf8"
  );

  assert.match(register, /namespace: "register-account"/);
  assert.match(register, /namespace: "register-ip"/);
  assert.match(register, /await bcrypt\.hash[\s\S]*?user\.findFirst/);
  assert.match(register, /mode: "insensitive"/);
  assert.doesNotMatch(register, /account with this email already exists/i);
  assert.match(register, /existingUser[\s\S]*?accepted: true[\s\S]*?status: 201/);
  assert.match(register, /after\(async \(\) =>/);

  assert.match(nextAuth, /callback\/credentials/);
  assert.match(nextAuth, /namespace: "login-account"/);
  assert.match(nextAuth, /namespace: "login-ip"/);
});

test("rate-limit responses are never cacheable", () => {
  const source = readFileSync(path.join(root, "src/lib/rate-limit.ts"), "utf8");
  assert.match(source, /"Cache-Control": "no-store"/);
});
