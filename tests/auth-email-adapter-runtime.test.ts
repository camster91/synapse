import assert from "node:assert/strict";
import test from "node:test";
import {
  authEmailErrorCode,
  emailDeliveryConfigured,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../src/lib/email";

const managedKeys = [
  "NODE_ENV",
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "AUTH_PUBLIC_URL",
  "NEXTAUTH_URL",
  "AUTH_EMAIL_LOCAL_SINK",
] as const;

type ManagedKey = (typeof managedKeys)[number];

function setEnvironment(key: ManagedKey, value: string | undefined) {
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  if (value === undefined) delete mutableEnvironment[key];
  else mutableEnvironment[key] = value;
}

function captureEnvironment() {
  return Object.fromEntries(managedKeys.map((key) => [key, process.env[key]]));
}

function restoreEnvironment(previous: Record<string, string | undefined>) {
  for (const key of managedKeys) setEnvironment(key, previous[key]);
}

test("Resend adapter emits fragment links, escaped HTML, idempotency metadata, and a timeout", async () => {
  const previous = captureEnvironment();
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;

  try {
    setEnvironment("NODE_ENV", "test");
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM = "Synapse <no-reply@example.test>";
    process.env.EMAIL_REPLY_TO = "support@example.test";
    process.env.AUTH_PUBLIC_URL = "https://beta.synapse.example";

    globalThis.fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return Response.json({ id: "mail-test-1" });
    };

    const result = await sendVerificationEmail({
      email: "operator@example.test",
      rawToken: "token<&material",
      tokenHash: "a".repeat(64),
    });

    assert.deepEqual(result, { provider: "resend", id: "mail-test-1" });
    assert.equal(capturedUrl, "https://api.resend.com/emails");
    const headers = new Headers(capturedInit?.headers);
    assert.equal(headers.get("Authorization"), "Bearer test-key");
    assert.equal(headers.get("Idempotency-Key"), `synapse-verify-${"a".repeat(24)}`);
    assert.ok(capturedInit?.signal instanceof AbortSignal);

    const payload = JSON.parse(String(capturedInit?.body)) as {
      to?: string[];
      reply_to?: string;
      text?: string;
      html?: string;
    };
    assert.deepEqual(payload.to, ["operator@example.test"]);
    assert.equal(payload.reply_to, "support@example.test");
    assert.match(payload.text ?? "", /https:\/\/beta\.synapse\.example\/verify-email#token=/);
    assert.doesNotMatch(payload.text ?? "", /\?token=/);
    assert.match(payload.html ?? "", /token%3C%26material/);
    assert.doesNotMatch(payload.html ?? "", /token<&material/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment(previous);
  }
});

test("provider failures expose a fixed code instead of the response body", async () => {
  const previous = captureEnvironment();
  const originalFetch = globalThis.fetch;

  try {
    setEnvironment("NODE_ENV", "test");
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM = "Synapse <no-reply@example.test>";
    process.env.AUTH_PUBLIC_URL = "https://beta.synapse.example";
    globalThis.fetch = async () => new Response("sensitive-provider-body", { status: 422 });

    await assert.rejects(
      sendPasswordResetEmail({
        email: "operator@example.test",
        rawToken: "reset-token",
        tokenHash: "b".repeat(64),
      }),
      (error: unknown) => authEmailErrorCode(error) === "email_provider_http_422",
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment(previous);
  }
});

test("local sink requires exact opt-in and a loopback authentication origin", async () => {
  const previous = captureEnvironment();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  try {
    // The production image is used for #29's disposable runtime smoke, so the
    // safety boundary is explicit opt-in plus a loopback auth origin—not NODE_ENV.
    setEnvironment("NODE_ENV", "production");
    process.env.EMAIL_PROVIDER = "local-sink";
    process.env.AUTH_EMAIL_LOCAL_SINK = "disposable-lifecycle-only";
    process.env.NEXTAUTH_URL = "http://127.0.0.1:3000";
    delete process.env.AUTH_PUBLIC_URL;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error("local sink must not call a provider");
    };

    assert.equal(emailDeliveryConfigured(), true);
    const result = await sendVerificationEmail({
      email: "disposable@synapse.invalid",
      rawToken: "discarded-token",
      tokenHash: "c".repeat(64),
    });
    assert.deepEqual(result, { provider: "local-sink", id: null });
    assert.equal(fetchCalled, false);

    process.env.AUTH_PUBLIC_URL = "https://beta.synapse.example";
    assert.equal(emailDeliveryConfigured(), false);
    await assert.rejects(
      sendVerificationEmail({
        email: "disposable@synapse.invalid",
        rawToken: "discarded-token",
        tokenHash: "d".repeat(64),
      }),
      (error: unknown) => authEmailErrorCode(error) === "email_local_sink_not_allowed",
    );

    process.env.AUTH_PUBLIC_URL = "http://127.0.0.1:3000";
    process.env.AUTH_EMAIL_LOCAL_SINK = "wrong-value";
    assert.equal(emailDeliveryConfigured(), false);
    await assert.rejects(
      sendVerificationEmail({
        email: "disposable@synapse.invalid",
        rawToken: "discarded-token",
        tokenHash: "e".repeat(64),
      }),
      (error: unknown) => authEmailErrorCode(error) === "email_local_sink_not_allowed",
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment(previous);
  }
});
