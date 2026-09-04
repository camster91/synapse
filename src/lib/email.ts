export interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

export function emailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.NEXTAUTH_URL);
}

export async function sendTransactionalEmail(message: TransactionalEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Transactional email delivery is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Transactional email provider returned ${response.status}`);
  }

  const data = (await response.json().catch(() => null)) as { id?: string } | null;
  return { provider: "resend" as const, id: data?.id ?? null };
}

function baseUrl() {
  const value = process.env.NEXTAUTH_URL;
  if (!value) throw new Error("NEXTAUTH_URL is required for authentication email links");
  return value.replace(/\/$/, "");
}

export async function sendVerificationEmail(input: {
  email: string;
  rawToken: string;
  tokenHash: string;
}) {
  const url = `${baseUrl()}/verify-email?token=${encodeURIComponent(input.rawToken)}`;
  return sendTransactionalEmail({
    to: input.email,
    subject: "Verify your Synapse email",
    text: `Verify your Synapse email within 30 minutes: ${url}`,
    html: `<p>Verify your Synapse email within 30 minutes.</p><p><a href="${url}">Verify email</a></p>`,
    idempotencyKey: `synapse-verify-${input.tokenHash.slice(0, 24)}`,
  });
}

export async function sendPasswordResetEmail(input: {
  email: string;
  rawToken: string;
  tokenHash: string;
}) {
  const url = `${baseUrl()}/reset-password?token=${encodeURIComponent(input.rawToken)}`;
  return sendTransactionalEmail({
    to: input.email,
    subject: "Reset your Synapse password",
    text: `Reset your Synapse password within 30 minutes: ${url}`,
    html: `<p>Reset your Synapse password within 30 minutes.</p><p><a href="${url}">Reset password</a></p>`,
    idempotencyKey: `synapse-reset-${input.tokenHash.slice(0, 24)}`,
  });
}
