import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registration = readFileSync("src/app/register/page.tsx", "utf8");
const login = readFileSync("src/app/login/page.tsx", "utf8");

test("registration prevents duplicate creation and exposes an accessible pending state", () => {
  assert.match(registration, /<form method="post"/);
  assert.match(registration, /if \(submitting\) return/);
  assert.match(registration, /aria-busy=\{submitting\}/);
  assert.match(registration, /disabled=\{submitting\}/);
  assert.match(registration, /Creating account…/);
  assert.match(registration, /finally \{\s+setSubmitting\(false\)/);
  assert.match(registration, /min-h-11/);
});

test("login recovers from provider and network failures without duplicate submission", () => {
  assert.match(login, /<form method="post"/);
  assert.match(login, /if \(submitting\) return/);
  assert.match(login, /aria-busy=\{submitting\}/);
  assert.match(login, /disabled=\{submitting\}/);
  assert.match(login, /Signing in…/);
  assert.match(login, /catch \{\s+setError\("Unable to sign in\. Check your connection and try again\."\)/);
  assert.match(login, /finally \{\s+setSubmitting\(false\)/);
  assert.doesNotMatch(login, /: result\.error/);
  assert.match(login, /min-h-11/);
});
