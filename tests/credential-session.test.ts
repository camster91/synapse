import assert from "node:assert/strict";
import test from "node:test";
import { reconcileCredentialSession } from "../src/lib/credential-session";

test("current credential session remains valid only on exact version match", () => {
  assert.deepEqual(
    reconcileCredentialSession(
      { credentialSession: true, credentialVersion: "version-1" },
      "version-1",
    ),
    { kind: "valid" },
  );
  assert.deepEqual(
    reconcileCredentialSession(
      { credentialSession: true, credentialVersion: "version-1" },
      "version-2",
    ),
    { kind: "invalid" },
  );
});

test("missing credentials account invalidates a credential token", () => {
  assert.deepEqual(
    reconcileCredentialSession(
      { credentialSession: true, credentialVersion: "version-1" },
      undefined,
    ),
    { kind: "invalid" },
  );
});

test("pre-versioning token adopts only a legacy null account version", () => {
  assert.deepEqual(
    reconcileCredentialSession({}, null),
    { kind: "adopt_legacy_null", credentialVersion: null },
  );
  assert.deepEqual(
    reconcileCredentialSession({}, "version-after-reset"),
    { kind: "invalid" },
  );
  assert.deepEqual(
    reconcileCredentialSession({}, undefined),
    { kind: "invalid" },
  );
});

test("explicit non-credential tokens remain outside password revocation", () => {
  assert.deepEqual(
    reconcileCredentialSession(
      { credentialSession: false },
      "unrelated-credentials-version",
    ),
    { kind: "not_credentials" },
  );
});

test("inconsistent or partially marked claims fail closed", () => {
  assert.deepEqual(
    reconcileCredentialSession(
      { credentialSession: true },
      null,
    ),
    { kind: "invalid" },
  );
  assert.deepEqual(
    reconcileCredentialSession(
      { credentialSession: false, credentialVersion: "unexpected-version" },
      "unexpected-version",
    ),
    { kind: "invalid" },
  );
});
