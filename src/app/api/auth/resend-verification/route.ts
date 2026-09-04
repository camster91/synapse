import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { createAuthToken, hasPendingVerification } from "@/lib/auth-tokens";
import { emailDeliveryConfigured, sendVerificationEmail } from "@/lib/email";
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
    namespace: "verify-resend-account",
    identifier: email,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!accountLimit.allowed) return rateLimitResponse(accountLimit.retryAfterSeconds);

  const clientIp = trustedClientIp(request);
  if (clientIp) {
    const ipLimit = consumeRateLimit({
      namespace: "verify-resend-ip",
      identifier: clientIp,
      maxAttempts: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: {
        where: { provider: "credentials" },
        select: { id: true },
      },
    },
  });

  if (user && user.accounts.length > 0 && await hasPendingVerification(user.id)) {
    const token = await createAuthToken("verify", user.id);
    try {
      await sendVerificationEmail({
        email: user.email,
        rawToken: token.rawToken,
        tokenHash: token.token,
      });
    } catch (error) {
      console.error("auth_email_delivery_failed", {
        type: "verification",
        provider: "resend",
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return NextResponse.json({ accepted: true }, { status: 202 });
}
