import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const email = readFileSync("src/lib/email.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");
const register = readFileSync("src/app/api/auth/register/route.ts", "utf8");
const forgot = readFileSync("src/app/api/auth/forgot-password/route.ts", "utf8");

test("transactional email requires explicit operator configuration", () => {
  assert.match(email, /EMAIL_PROVIDER/);
  assert.match(email, /RESEND_API_KEY/);
  assert.match(email, /EMAIL_FROM/);
  assert.match(email, /AUTH_PUBLIC_URL/);
  assert.match(email, /NEXTAUTH_URL/);
  assert.match(register, /Email delivery is not configured/);
  assert.match(forgot, /Email delivery is not configured/);
  assert.match(envExample, /EMAIL_PROVIDER="resend"/);
  assert.match(envExample, /RESEND_API_KEY=""/);
  assert.match(envExample, /EMAIL_FROM=/);
  assert.match(envExample, /EMAIL_REPLY_TO=/);
  assert.match(envExample, /AUTH_PUBLIC_URL=/);
});

test("email adapter uses the documented Resend REST contract without an SDK dependency", () => {
  assert.match(email, /https:\/\/api\.resend\.com\/emails/);
  assert.match(email, /Authorization: `Bearer \$\{config\.apiKey\}`/);
  assert.match(email, /"Content-Type": "application\/json"/);
  assert.match(email, /"Idempotency-Key": message\.idempotencyKey/);
});

test("authentication links keep bearer tokens in URL fragments rather than request query strings", () => {
  assert.match(email, /url\.hash = new URLSearchParams\(\{ token: rawToken \}\)\.toString\(\)/);
  assert.match(email, /input\.tokenHash\.slice\(0, 24\)/);
  assert.match(email, /escapeHtml\(url\)/);
  assert.doesNotMatch(register, /rawToken.*console/);
  assert.doesNotMatch(forgot, /rawToken.*console/);
});
