import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registerRoute = readFileSync("src/app/api/auth/register/route.ts", "utf8");
const verifyRoute = readFileSync("src/app/api/auth/verify-email/route.ts", "utf8");
const resendRoute = readFileSync("src/app/api/auth/resend-verification/route.ts", "utf8");
const forgotRoute = readFileSync("src/app/api/auth/forgot-password/route.ts", "utf8");
const resetRoute = readFileSync("src/app/api/auth/reset-password/route.ts", "utf8");
const auth = readFileSync("src/lib/auth.ts", "utf8");
const tokens = readFileSync("src/lib/auth-tokens.ts", "utf8");
const registerPage = readFileSync("src/app/register/page.tsx", "utf8");

test("new credentials registrations require a verification marker before sign in", () => {
  assert.match(registerRoute, /generateAuthToken\("verify", user\.id\)/);
  assert.match(registerRoute, /tx\.verificationToken\.create/);
  assert.match(registerRoute, /tx\.account\.create/);
  assert.match(auth, /hasPendingVerification/);
  assert.match(auth, /Email verification required/);
  assert.match(registerRoute, /NextResponse\.json\(\{ accepted: true \}/);
  assert.doesNotMatch(registerRoute, /createdAt: user\.createdAt/);
  assert.doesNotMatch(registerPage, /signIn\("credentials"/);
  assert.match(registerPage, /\/verify-email\?sent=1/);
});

test("authentication tokens are random, hashed at rest, time limited, and single use", () => {
  assert.match(tokens, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(tokens, /createHash\("sha256"\)/);
  assert.match(tokens, /30 \* 60 \* 1000/);
  assert.match(verifyRoute, /verificationToken\.deleteMany/);
  assert.match(verifyRoute, /expires: \{ gt: new Date\(\) \}/);
});

test("verification resend and password reset requests keep an enumeration-neutral public response", () => {
  assert.match(resendRoute, /\{ accepted: true \}/);
  assert.match(forgotRoute, /\{ accepted: true \}/);
  assert.doesNotMatch(resendRoute, /User not found/);
  assert.doesNotMatch(forgotRoute, /User not found/);
});

test("password reset consumes its token, rotates credential sessions, and proves mailbox control", () => {
  assert.match(resetRoute, /verificationToken\.deleteMany/);
  assert.match(resetRoute, /createCredentialSessionVersion/);
  assert.match(resetRoute, /refreshToken: sessionVersion/);
  assert.match(resetRoute, /identifier: `verify:\$\{token\.userId\}`/);
  assert.match(resetRoute, /session\.deleteMany/);
  assert.match(auth, /token\.credentialVersion !== currentVersion/);
  assert.match(auth, /credentialsInvalidated = true/);
});
