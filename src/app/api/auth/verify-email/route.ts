import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { findAuthToken } from "@/lib/auth-tokens";
import { consumeRateLimit, rateLimitResponse, trustedClientIp } from "@/lib/rate-limit";

const schema = z.object({ token: z.string().min(20).max(256) });

function invalidLinkResponse() {
  return NextResponse.json(
    { verified: false, error: "Invalid or expired verification link" },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidLinkResponse();

  const tokenLimit = consumeRateLimit({
    namespace: "email-verification-token",
    identifier: parsed.data.token,
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!tokenLimit.allowed) return rateLimitResponse(tokenLimit.retryAfterSeconds);

  const clientIp = trustedClientIp(request);
  if (clientIp) {
    const ipLimit = consumeRateLimit({
      namespace: "email-verification-ip",
      identifier: clientIp,
      maxAttempts: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);
  }

  const token = await findAuthToken("verify", parsed.data.token);
  if (!token) return invalidLinkResponse();

  try {
    await prisma.$transaction(async (tx) => {
      // The matching row is the atomic one-time bearer transition.
      const consumed = await tx.verificationToken.deleteMany({
        where: {
          identifier: token.identifier,
          token: token.token,
          expires: { gt: new Date() },
        },
      });
      if (consumed.count !== 1) throw new Error("VERIFY_TOKEN_CONSUMED");

      // Resends may leave several still-valid links so an anonymous request
      // cannot invalidate a delivered one. Once any valid link succeeds, clear
      // every sibling marker and complete verification exactly once.
      await tx.verificationToken.deleteMany({
        where: { identifier: token.identifier },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "VERIFY_TOKEN_CONSUMED") {
      return invalidLinkResponse();
    }
    console.error("auth_email_verification_failed", {
      code: "email_verification_failed",
    });
    return NextResponse.json(
      { verified: false, error: "Unable to verify email" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { verified: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
