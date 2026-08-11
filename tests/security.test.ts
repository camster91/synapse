import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret } from "../src/lib/security/secrets";

const key = "0123456789abcdef0123456789abcdef";

test("encryptSecret round-trips a provider key without retaining plaintext", () => {
  const plaintext = "sk-private-provider-key";
  const encrypted = encryptSecret(plaintext, key);

  assert.notEqual(encrypted, plaintext);
  assert.ok(encrypted.startsWith("v1:"));
  assert.equal(decryptSecret(encrypted, key), plaintext);
});

test("decryptSecret rejects values encrypted with a different key", () => {
  const encrypted = encryptSecret("sk-private-provider-key", key);

  assert.throws(
    () => decryptSecret(encrypted, "fedcba9876543210fedcba9876543210"),
    /Unable to decrypt secret/
  );
});
