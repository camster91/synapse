import assert from "node:assert/strict";
import test from "node:test";
import { postAuthenticationPath } from "../src/lib/routes";

test("authenticated users are sent to the dashboard route, not the public landing page", () => {
  assert.equal(postAuthenticationPath(), "/today");
});
