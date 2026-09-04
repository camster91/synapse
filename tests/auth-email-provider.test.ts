import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const email = readFileSync("src/lib/email.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");
const register = readFileSync("src/app/api/auth/register/route.ts", "utf8");
const forgot = readFileSync("src/app/api/auth/forgot-password/route.ts", "utf8");

test("transactional email requires explicit operator configuration", () => {
  assert.match(email, /RESEND_API_KEY/);
  assert.match(email, /EMAIL_FROM/);
  assert.match(email, /NEXTAUTH_URL/);
  assert.match(register, /Email delivery is not configured/);
  assert.match(forgot, /Email delivery is not configured/);
  assert.match(envExample, /RESEND_API_KEY=""/);
  assert.match(envExample, /EMAIL_FROM=/);
});

test("email adapter uses the documented Resend REST contract without an SDK dependency", () => {
  assert.match(email, /https:\/\/api\.resend\.com\/emails/);
  assert.match(email, /Authorization: `Bearer \$\{apiKey\}`/);
  assert.match(email, /"Content-Type": "application\/json"/);
  assert.match(email, /"Idempotency-Key": message\.idempotencyKey/);
});

test("email links contain raw tokens only in delivery payloads and token hashes in idempotency keys", () => {
  assert.match(email, /encodeURIComponent\(input\.rawToken\)/);
  assert.match(email, /input\.tokenHash\.slice\(0, 24\)/);
  assert.doesNotMatch(register, /rawToken.*console/);
  assert.doesNotMatch(forgot, /rawToken.*console/);
});
