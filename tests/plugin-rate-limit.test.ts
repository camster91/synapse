import assert from "node:assert/strict";
import test from "node:test";
import { checkPluginRateLimit } from "../src/lib/plugins/executor";

test("plugin rate limits are isolated by user and plugin", () => {
  const plugin = `plugin-${crypto.randomUUID()}`;
  const userA = `user-a-${crypto.randomUUID()}`;
  const userB = `user-b-${crypto.randomUUID()}`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    assert.doesNotThrow(() => checkPluginRateLimit(userA, plugin, 1_000));
  }
  assert.throws(
    () => checkPluginRateLimit(userA, plugin, 1_000),
    /exceeded rate limit/
  );

  assert.doesNotThrow(() => checkPluginRateLimit(userB, plugin, 1_000));
  assert.doesNotThrow(() => checkPluginRateLimit(userA, `${plugin}-other`, 1_000));
});

test("plugin rate limits reset after the window", () => {
  const plugin = `plugin-${crypto.randomUUID()}`;
  const user = `user-${crypto.randomUUID()}`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    checkPluginRateLimit(user, plugin, 1_000);
  }
  assert.throws(() => checkPluginRateLimit(user, plugin, 1_000));
  assert.doesNotThrow(() => checkPluginRateLimit(user, plugin, 61_001));
});
