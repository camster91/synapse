import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  authEmailErrorCode,
  sendVerificationEmail,
} from "../src/lib/email";

const managedKeys = [
  "NODE_ENV",
  "EMAIL_PROVIDER",
  "AUTH_EMAIL_FILE_DIR",
  "AUTH_PUBLIC_URL",
  "NEXTAUTH_URL",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
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

test("file provider writes a private fragment-link message outside production", async () => {
  const previous = captureEnvironment();
  const directory = await mkdtemp(path.join(os.tmpdir(), "synapse-auth-mail-"));

  try {
    process.env.NODE_ENV = "test";
    process.env.EMAIL_PROVIDER = "file";
    process.env.AUTH_EMAIL_FILE_DIR = directory;
    process.env.AUTH_PUBLIC_URL = "https://beta.synapse.example";
    process.env.EMAIL_FROM = "Synapse <local@synapse.invalid>";

    const rawToken = "verification-token-material";
    const result = await sendVerificationEmail({
      email: "operator@example.test",
      rawToken,
      tokenHash: "a".repeat(64),
    });
    assert.equal(result.provider, "file");

    const files = await readdir(directory);
    assert.equal(files.length, 1);
    const filepath = path.join(directory, files[0]);
    const message = JSON.parse(await readFile(filepath, "utf8")) as {
      kind?: string;
      to?: string;
      text?: string;
    };

    assert.equal(message.kind, "verification");
    assert.equal(message.to, "operator@example.test");
    assert.match(message.text ?? "", /https:\/\/beta\.synapse\.example\/verify-email#token=/);
    assert.match(message.text ?? "", new RegExp(rawToken));
    assert.doesNotMatch(message.text ?? "", /\?token=/);
    assert.equal((await stat(filepath)).mode & 0o777, 0o600);
  } finally {
    restoreEnvironment(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("file provider is refused in production", async () => {
  const previous = captureEnvironment();
  try {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "file";
    process.env.AUTH_EMAIL_FILE_DIR = path.join(os.tmpdir(), "synapse-forbidden-mail");
    process.env.AUTH_PUBLIC_URL = "https://beta.synapse.example";

    await assert.rejects(
      sendVerificationEmail({
        email: "operator@example.test",
        rawToken: "token",
        tokenHash: "b".repeat(64),
      }),
      (error: unknown) => authEmailErrorCode(error) === "email_file_provider_forbidden",
    );
  } finally {
    restoreEnvironment(previous);
  }
});

test("file provider refuses a publicly served outbox", async () => {
  const previous = captureEnvironment();
  try {
    process.env.NODE_ENV = "test";
    process.env.EMAIL_PROVIDER = "file";
    process.env.AUTH_EMAIL_FILE_DIR = path.join(process.cwd(), "public", "auth-mail");
    process.env.AUTH_PUBLIC_URL = "https://beta.synapse.example";

    await assert.rejects(
      sendVerificationEmail({
        email: "operator@example.test",
        rawToken: "token",
        tokenHash: "c".repeat(64),
      }),
      (error: unknown) => authEmailErrorCode(error) === "email_file_outbox_public",
    );
  } finally {
    restoreEnvironment(previous);
  }
});
