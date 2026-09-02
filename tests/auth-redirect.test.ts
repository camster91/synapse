import assert from "node:assert/strict";
import test from "node:test";
import { postAuthenticationPath, safePostAuthenticationPath } from "../src/lib/routes";

test("authenticated users are sent to the dashboard route, not the public landing page", () => {
  assert.equal(postAuthenticationPath(), "/today");
});

test("authentication preserves only safe authenticated destinations", () => {
  const origin = "https://synapse.example";
  assert.equal(safePostAuthenticationPath("/settings?tab=data#export", origin), "/settings?tab=data#export");
  assert.equal(safePostAuthenticationPath("https://synapse.example/notes/abc", origin), "/notes/abc");
  assert.equal(safePostAuthenticationPath("https://attacker.example/settings", origin), "/today");
  assert.equal(safePostAuthenticationPath("//attacker.example/settings", origin), "/today");
  assert.equal(safePostAuthenticationPath("/login", origin), "/today");
  assert.equal(safePostAuthenticationPath(null, origin), "/today");
});
