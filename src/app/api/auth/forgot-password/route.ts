import { after, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { createAuthToken } from "@/lib/auth-tokens";
import {
  authEmailErrorCode,
  emailDeliveryConfigured,
  sendPasswordResetEmail,
} from "@/lib/email";
import { consumeRateLimit, rateLimitResponse, trustedClientIp } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email() });

function acceptedResponse() {
  return NextResponse.json(
    { accepted: true },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!emailDeliveryConfigured()) {
    return NextResponse.json(
      { error: "Email delivery is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return acceptedResponse();

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

  // Account lookup, token issuance, and provider delivery all happen after the
  // generic response so known and unknown accounts share the same public path.
  after(async () => {
    try {
      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        include: {
          accounts: {
            where: { provider: "credentials" },
            select: { id: true },
          },
        },
      });
      if (!user || user.accounts.length === 0) return;

      const token = await createAuthToken("reset", user.id);
      try {
        await sendPasswordResetEmail({
          email: user.email,
          rawToken: token.rawToken,
          tokenHash: token.token,
        });
      } catch (error) {
        // Remove only this undelivered reset token. Verification markers are
        // never removed on delivery failure because that would enable sign-in.
        await prisma.verificationToken.deleteMany({
          where: { token: token.token },
        }).catch(() => undefined);
        console.error("auth_email_delivery_failed", {
          type: "password_reset",
          provider: "resend",
          code: authEmailErrorCode(error),
        });
      }
    } catch {
      console.error("auth_password_reset_issue_failed", {
        code: "password_reset_issue_failed",
      });
    }
  });

  return acceptedResponse();
}
