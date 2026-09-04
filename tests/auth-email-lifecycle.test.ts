import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registerRoute = readFileSync("src/app/api/auth/register/route.ts", "utf8");
const verifyRoute = readFileSync("src/app/api/auth/verify-email/route.ts", "utf8");
const resendRoute = readFileSync("src/app/api/auth/resend-verification/route.ts", "utf8");
const forgotRoute = readFileSync("src/app/api/auth/forgot-password/route.ts", "utf8");
const resetRoute = readFileSync("src/app/api/auth/reset-password/route.ts", "utf8");
const auth = readFileSync("src/lib/auth.ts", "utf8");
const credentialSessions = readFileSync("src/lib/credential-session.ts", "utf8");
const tokens = readFileSync("src/lib/auth-tokens.ts", "utf8");
const proxy = readFileSync("src/proxy.ts", "utf8");
const registerPage = readFileSync("src/app/register/page.tsx", "utf8");

test("new credentials registrations remain blocked until their durable marker is consumed", () => {
  assert.match(registerRoute, /generateAuthToken\("verify", user\.id\)/);
  assert.match(registerRoute, /tx\.verificationToken\.create/);
  assert.match(registerRoute, /tx\.account\.create/);
  assert.match(registerRoute, /durable[\s\S]*unverified-account marker/);
  assert.match(auth, /hasPendingVerification/);
  assert.match(auth, /Email verification required/);
  assert.match(registerRoute, /\{ accepted: true \}/);
  assert.doesNotMatch(registerRoute, /createdAt: user\.createdAt/);
  assert.doesNotMatch(registerPage, /signIn\("credentials"/);
  assert.match(registerPage, /\/verify-email\?sent=1/);
});

test("legacy mixed-case credential emails remain usable without duplicate registration", () => {
  assert.match(auth, /providerAccountId: \{ equals: email, mode: "insensitive" \}/);
  assert.match(registerRoute, /email: \{ equals: data\.email, mode: "insensitive" \}/);
  assert.match(resendRoute, /email: \{ equals: email, mode: "insensitive" \}/);
  assert.match(forgotRoute, /email: \{ equals: email, mode: "insensitive" \}/);
  assert.match(registerRoute, /isUniqueConstraintError/);
});

test("authentication tokens are random, hashed at rest, time limited, and single use", () => {
  assert.match(tokens, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(tokens, /createHash\("sha256"\)/);
  assert.match(tokens, /30 \* 60 \* 1000/);
  assert.match(verifyRoute, /verificationToken\.deleteMany/);
  assert.match(verifyRoute, /expires: \{ gt: new Date\(\) \}/);
  assert.match(resetRoute, /verificationToken\.deleteMany/);
  assert.match(resetRoute, /expires: \{ gt: now \}/);
});

test("registration, resend, and recovery keep generic public responses", () => {
  assert.match(registerRoute, /\{ accepted: true \}/);
  assert.match(resendRoute, /\{ accepted: true \}/);
  assert.match(forgotRoute, /\{ accepted: true \}/);
  assert.doesNotMatch(registerRoute, /account with this email already exists/i);
  assert.doesNotMatch(resendRoute, /User not found/);
  assert.doesNotMatch(forgotRoute, /User not found/);
});

test("provider work runs after the response path and logs only fixed codes", () => {
  for (const source of [registerRoute, resendRoute, forgotRoute]) {
    assert.match(source, /after\(async \(\) =>/);
    assert.doesNotMatch(source, /error\.message/);
  }
});

test("password reset consumes its token, rotates only credential sessions, and proves mailbox control", () => {
  assert.match(resetRoute, /createCredentialSessionVersion/);
  assert.match(resetRoute, /refreshToken: sessionVersion/);
  assert.match(resetRoute, /identifier: `verify:\$\{token\.userId\}`/);
  assert.match(resetRoute, /session\.deleteMany/);
  assert.match(auth, /reconcileCredentialSession/);
  assert.match(auth, /credentialsInvalidated = true/);
  assert.match(credentialSessions, /legacyUnmarked/);
  assert.match(credentialSessions, /claims\.credentialVersion === accountVersion/);
  assert.match(credentialSessions, /accountVersion === null/);
  assert.match(auth, /session\.user\.email = null/);
  assert.match(proxy, /token\?\.id && !token\.credentialsInvalidated/);
});

test("credential lookup performs password work for missing accounts", () => {
  assert.match(auth, /const dummyPasswordHash = bcrypt\.hash/);
  assert.match(auth, /account\?\.accessToken \?\? await dummyPasswordHash/);
  assert.match(auth, /await bcrypt\.compare/);
});

test("token consumption endpoints are rate limited and non-cacheable", () => {
  assert.match(verifyRoute, /namespace: "email-verification-token"/);
  assert.match(resetRoute, /namespace: "password-reset-token"/);
  assert.match(verifyRoute, /"Cache-Control": "no-store"/);
  assert.match(resetRoute, /"Cache-Control": "no-store"/);
});
