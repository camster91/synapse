import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const email = readFileSync("src/lib/email.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");
const register = readFileSync("src/app/api/auth/register/route.ts", "utf8");
const forgot = readFileSync("src/app/api/auth/forgot-password/route.ts", "utf8");
const resend = readFileSync("src/app/api/auth/resend-verification/route.ts", "utf8");
const verifyPage = readFileSync("src/app/verify-email/page.tsx", "utf8");
const resetPage = readFileSync("src/app/reset-password/page.tsx", "utf8");

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

test("email adapter uses the fixed Resend REST contract without an SDK dependency", () => {
  assert.match(email, /https:\/\/api\.resend\.com\/emails/);
  assert.match(email, /Authorization: `Bearer \$\{config\.apiKey\}`/);
  assert.match(email, /"Content-Type": "application\/json"/);
  assert.match(email, /"Idempotency-Key": message\.idempotencyKey/);
  assert.doesNotMatch(email, /await response\.text/);
});

test("disposable local sink requires exact opt-in and a loopback public URL", () => {
  assert.match(email, /LOCAL_SINK_OPT_IN = "disposable-lifecycle-only"/);
  assert.match(email, /provider === "local-sink"/);
  assert.match(email, /AUTH_EMAIL_LOCAL_SINK !== LOCAL_SINK_OPT_IN/);
  assert.match(email, /isLoopbackHost\(baseUrl\.hostname\)/);
  assert.match(email, /No recipient, body, or bearer token is written to logs or files/);
});

test("bearer tokens use URL fragments and are removed from browser history", () => {
  assert.match(email, /url\.hash = new URLSearchParams\(\{ token: rawToken \}\)\.toString\(\)/);
  assert.doesNotMatch(email, /\?token=/);
  assert.match(email, /input\.tokenHash\.slice\(0, 24\)/);
  assert.match(email, /escapeHtml\(url\)/);
  assert.match(verifyPage, /window\.location\.hash\.slice\(1\)/);
  assert.match(resetPage, /window\.location\.hash\.slice\(1\)/);
  assert.match(verifyPage, /window\.history\.replaceState/);
  assert.match(resetPage, /window\.history\.replaceState/);
});

test("delivery evidence uses fixed codes without recipients, tokens, or provider bodies", () => {
  assert.match(email, /authEmailErrorCode/);
  assert.match(register, /code: authEmailErrorCode\(error\)/);
  assert.match(forgot, /code: authEmailErrorCode\(error\)/);
  assert.match(resend, /code: authEmailErrorCode\(error\)/);
  assert.doesNotMatch(register, /rawToken.*console/);
  assert.doesNotMatch(forgot, /rawToken.*console/);
  assert.doesNotMatch(resend, /rawToken.*console/);
  assert.doesNotMatch(register, /error\.message/);
  assert.doesNotMatch(forgot, /error\.message/);
  assert.doesNotMatch(resend, /error\.message/);
});
