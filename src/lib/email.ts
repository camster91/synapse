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

const LOCAL_SINK_OPT_IN = "disposable-lifecycle-only";

function isLoopbackHost(hostname: string) {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname);
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

  if (parsed.protocol !== "https:" && !isLoopbackHost(parsed.hostname)) {
    throw new TransactionalEmailError("auth_public_url_insecure");
  }

  return new URL("/", parsed.origin);
}

function emailProviderConfig() {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (provider === "local-sink") {
    const baseUrl = publicAuthBaseUrl();
    if (
      process.env.AUTH_EMAIL_LOCAL_SINK !== LOCAL_SINK_OPT_IN ||
      !isLoopbackHost(baseUrl.hostname)
    ) {
      throw new TransactionalEmailError("email_local_sink_not_allowed");
    }

    return {
      provider: "local-sink" as const,
      apiKey: null,
      from: "Synapse Local Smoke <no-reply@synapse.invalid>",
      replyTo: null,
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (provider !== "resend" || !apiKey || !from) {
    throw new TransactionalEmailError(
      "email_provider_unconfigured",
      "Transactional email delivery is not configured",
    );
  }

  return {
    provider: "resend" as const,
    apiKey,
    from,
    replyTo: process.env.EMAIL_REPLY_TO?.trim() || null,
  };
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

export async function sendTransactionalEmail(message: TransactionalEmail) {
  const config = emailProviderConfig();

  // Deliberately discard the message in disposable loopback smoke environments.
  // No recipient, body, or bearer token is written to logs or files.
  if (config.provider === "local-sink") {
    return { provider: config.provider, id: null };
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
  return { provider: config.provider, id: data?.id ?? null };
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
