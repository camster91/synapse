import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type AuthEmailKind = "verification" | "password_reset";

export interface TransactionalEmail {
  kind: AuthEmailKind;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

export class TransactionalEmailError extends Error {
  constructor(
    public readonly code: string,
    message = "Transactional email delivery failed",
  ) {
    super(message);
    this.name = "TransactionalEmailError";
  }
}

type EmailProviderConfig =
  | {
      provider: "resend";
      apiKey: string;
      from: string;
      replyTo: string | null;
    }
  | {
      provider: "file";
      directory: string;
      from: string;
      replyTo: string | null;
    };

function safeFileOutbox(directory: string) {
  const resolved = path.resolve(directory);
  const publicDirectory = path.resolve(process.cwd(), "public");
  if (resolved === publicDirectory || resolved.startsWith(`${publicDirectory}${path.sep}`)) {
    throw new TransactionalEmailError("email_file_outbox_public");
  }
  return resolved;
}

function emailProviderConfig(): EmailProviderConfig {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  const from = process.env.EMAIL_FROM?.trim();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || null;

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey || !from) {
      throw new TransactionalEmailError(
        "email_provider_unconfigured",
        "Transactional email delivery is not configured",
      );
    }
    return { provider, apiKey, from, replyTo };
  }

  if (provider === "file") {
    if (process.env.NODE_ENV === "production") {
      throw new TransactionalEmailError("email_file_provider_forbidden");
    }
    const directory = process.env.AUTH_EMAIL_FILE_DIR?.trim();
    if (!directory) {
      throw new TransactionalEmailError("email_file_outbox_unconfigured");
    }
    return {
      provider,
      directory: safeFileOutbox(directory),
      from: from || "Synapse <local@synapse.invalid>",
      replyTo,
    };
  }

  throw new TransactionalEmailError(
    "email_provider_unconfigured",
    "Transactional email delivery is not configured",
  );
}

function publicAuthBaseUrl() {
  const configured = process.env.AUTH_PUBLIC_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!configured) {
    throw new TransactionalEmailError(
      "auth_public_url_unconfigured",
      "Authentication public URL is not configured",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new TransactionalEmailError("auth_public_url_invalid");
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new TransactionalEmailError("auth_public_url_invalid");
  }

  return new URL("/", parsed.origin);
}

export function emailDeliveryConfigured() {
  try {
    emailProviderConfig();
    publicAuthBaseUrl();
    return true;
  } catch {
    return false;
  }
}

export function authEmailErrorCode(error: unknown) {
  return error instanceof TransactionalEmailError
    ? error.code
    : "email_delivery_unknown";
}

async function writeFileOutbox(
  config: Extract<EmailProviderConfig, { provider: "file" }>,
  message: TransactionalEmail,
) {
  await mkdir(config.directory, { recursive: true, mode: 0o700 });
  const id = `${Date.now()}-${randomUUID()}`;
  const filename = path.join(config.directory, `${id}.json`);
  await writeFile(
    filename,
    JSON.stringify({
      id,
      provider: config.provider,
      kind: message.kind,
      from: config.from,
      to: message.to,
      replyTo: config.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
      idempotencyKey: message.idempotencyKey,
      createdAt: new Date().toISOString(),
    }, null, 2),
    { encoding: "utf8", mode: 0o600 },
  );
  return { provider: config.provider, id } as const;
}

export async function sendTransactionalEmail(message: TransactionalEmail) {
  const config = emailProviderConfig();
  if (config.provider === "file") {
    return writeFileOutbox(config, message);
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
    });
  } catch {
    throw new TransactionalEmailError("email_provider_network_error");
  }

  if (!response.ok) {
    throw new TransactionalEmailError(`email_provider_http_${response.status}`);
  }

  const data = (await response.json().catch(() => null)) as { id?: string } | null;
  return { provider: config.provider, id: data?.id ?? null } as const;
}

function actionUrl(pathname: "/verify-email" | "/reset-password", rawToken: string) {
  const url = new URL(pathname, publicAuthBaseUrl());
  // Keep raw bearer tokens out of server access logs and referrer query strings.
  url.hash = new URLSearchParams({ token: rawToken }).toString();
  return url.toString();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendVerificationEmail(input: {
  email: string;
  rawToken: string;
  tokenHash: string;
}) {
  const url = actionUrl("/verify-email", input.rawToken);
  const safeUrl = escapeHtml(url);
  return sendTransactionalEmail({
    kind: "verification",
    to: input.email,
    subject: "Verify your Synapse email",
    text: `Verify your Synapse email within 30 minutes: ${url}`,
    html: `<p>Verify your Synapse email within 30 minutes.</p><p><a href="${safeUrl}">Verify email</a></p>`,
    idempotencyKey: `synapse-verify-${input.tokenHash.slice(0, 24)}`,
  });
}

export async function sendPasswordResetEmail(input: {
  email: string;
  rawToken: string;
  tokenHash: string;
}) {
  const url = actionUrl("/reset-password", input.rawToken);
  const safeUrl = escapeHtml(url);
  return sendTransactionalEmail({
    kind: "password_reset",
    to: input.email,
    subject: "Reset your Synapse password",
    text: `Reset your Synapse password within 30 minutes: ${url}`,
    html: `<p>Reset your Synapse password within 30 minutes.</p><p><a href="${safeUrl}">Reset password</a></p>`,
    idempotencyKey: `synapse-reset-${input.tokenHash.slice(0, 24)}`,
  });
}
