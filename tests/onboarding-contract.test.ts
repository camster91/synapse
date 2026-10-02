import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { postAuthenticationPath, postRegistrationPath } from "../src/lib/routes";

const registration = readFileSync("src/app/register/page.tsx", "utf8");
const onboardingApi = readFileSync("src/app/api/onboarding/route.ts", "utf8");
const middleware = readFileSync("src/proxy.ts", "utf8");
const landing = readFileSync("src/app/page.tsx", "utf8");

test("new accounts verify email before accessing onboarding and the dashboard", () => {
  assert.equal(postRegistrationPath(), "/onboarding");
  assert.equal(postAuthenticationPath(), "/today");
  assert.match(registration, /router\.push\("\/verify-email\?sent=1"\)/);
  assert.doesNotMatch(registration, /router\.push\(postRegistrationPath\(\)\)/);
});

test("onboarding atomically creates first-value records and supports a skip path", () => {
  assert.match(onboardingApi, /prisma\.\$transaction/);
  assert.match(onboardingApi, /tx\.goal\.create/);
  assert.match(onboardingApi, /tx\.habit\.create/);
  assert.match(onboardingApi, /tx\.todo\.create/);
  assert.match(onboardingApi, /onboardingComplete: true/);
  assert.match(onboardingApi, /if \(!data\.skip/);
});

test("the landing page is public while product pages remain protected", () => {
  assert.match(middleware, /"\/today"/);
  assert.match(middleware, /"\/onboarding"/);
  assert.match(middleware, /if \(!isProtectedPath\(req\.nextUrl\.pathname\)\) return true/);
  assert.match(middleware, /return Boolean\(token\?\.id && !token\.credentialsInvalidated\)/);
});

test("landing copy does not claim unimplemented time blocking or AI mutations", () => {
  assert.doesNotMatch(landing, /Time-block tasks/);
  assert.doesNotMatch(landing, /Log my habit/);
  assert.match(landing, /connect your own AI provider/i);
});
