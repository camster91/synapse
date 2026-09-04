import assert from "node:assert/strict";
import test from "node:test";
import {
  authEmailErrorCode,
  emailDeliveryConfigured,
  sendVerificationEmail,
} from "../src/lib/email";

const managedKeys = [
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "AUTH_PUBLIC_URL",
  "NEXTAUTH_URL",
] as const;

function captureEnvironment() {
  return Object.fromEntries(managedKeys.map((key) => [key, process.env[key]]));
}

function restoreEnvironment(previous: Record<string, string | undefined>) {
  for (const key of managedKeys) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function expectConfigurationError(url: string, code: string) {
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = "Synapse <no-reply@example.test>";
  process.env.AUTH_PUBLIC_URL = url;

  assert.equal(emailDeliveryConfigured(), false);
  await assert.rejects(
    sendVerificationEmail({
      email: "operator@example.test",
      rawToken: "verification-token",
      tokenHash: "a".repeat(64),
    }),
    (error: unknown) => authEmailErrorCode(error) === code,
  );
}

test("remote authentication links require HTTPS", async () => {
  const previous = captureEnvironment();
  try {
    await expectConfigurationError(
      "http://beta.synapse.example",
      "auth_public_url_insecure",
    );
  } finally {
    restoreEnvironment(previous);
  }
});

test("authentication link origins reject embedded credentials", async () => {
  const previous = captureEnvironment();
  try {
    await expectConfigurationError(
      "https://user:password@beta.synapse.example",
      "auth_public_url_invalid",
    );
  } finally {
    restoreEnvironment(previous);
  }
});

test("loopback HTTP remains available for disposable local validation", () => {
  const previous = captureEnvironment();
  try {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM = "Synapse <no-reply@example.test>";
    process.env.AUTH_PUBLIC_URL = "http://127.0.0.1:3000";
    assert.equal(emailDeliveryConfigured(), true);
  } finally {
    restoreEnvironment(previous);
  }
});
