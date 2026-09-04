import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { createAuthToken } from "@/lib/auth-tokens";
import { emailDeliveryConfigured, sendPasswordResetEmail } from "@/lib/email";
import { consumeRateLimit, rateLimitResponse, trustedClientIp } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  if (!emailDeliveryConfigured()) {
    return NextResponse.json({ error: "Email delivery is not configured" }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ accepted: true }, { status: 202 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const accountLimit = consumeRateLimit({
    namespace: "password-reset-account",
    identifier: email,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!accountLimit.allowed) return rateLimitResponse(accountLimit.retryAfterSeconds);

  const clientIp = trustedClientIp(request);
  if (clientIp) {
    const ipLimit = consumeRateLimit({
      namespace: "password-reset-ip",
      identifier: clientIp,
      maxAttempts: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: {
      accounts: {
        where: { provider: "credentials" },
        select: { id: true },
      },
    },
  });

  if (user && user.accounts.length > 0) {
    const token = await createAuthToken("reset", user.id);
    try {
      await sendPasswordResetEmail({
        email: user.email,
        rawToken: token.rawToken,
        tokenHash: token.token,
      });
    } catch (error) {
      // Keep the public response identical for known and unknown accounts.
      console.error("auth_email_delivery_failed", {
        type: "password_reset",
        provider: "resend",
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return NextResponse.json({ accepted: true }, { status: 202 });
}
