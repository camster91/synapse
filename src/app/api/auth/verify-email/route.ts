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

  // Deletion is the atomic state transition: this row is both the hashed
  // one-time bearer token and the durable unverified-account marker.
  const deleted = await prisma.verificationToken.deleteMany({
    where: {
      identifier: token.identifier,
      token: token.token,
      expires: { gt: new Date() },
    },
  });

  if (deleted.count !== 1) return invalidLinkResponse();

  return NextResponse.json(
    { verified: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
