import { after, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { createAuthToken, hasPendingVerification } from "@/lib/auth-tokens";
import {
  authEmailErrorCode,
  emailDeliveryConfigured,
  sendVerificationEmail,
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
      if (
        !user ||
        user.accounts.length === 0 ||
        !await hasPendingVerification(user.id)
      ) {
        return;
      }

      const token = await createAuthToken("verify", user.id);
      try {
        await sendVerificationEmail({
          email: user.email,
          rawToken: token.rawToken,
          tokenHash: token.token,
        });
      } catch (error) {
        // Keep the durable verification marker in place on delivery failure.
        console.error("auth_email_delivery_failed", {
          type: "verification",
          provider: "resend",
          code: authEmailErrorCode(error),
        });
      }
    } catch {
      // Never expose whether a matching unverified account exists.
      console.error("auth_verification_resend_failed", {
        code: "verification_resend_failed",
      });
    }
  });

  return acceptedResponse();
}
