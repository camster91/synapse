import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import {
  createCredentialSessionVersion,
  findAuthToken,
} from "@/lib/auth-tokens";
import { consumeRateLimit, rateLimitResponse, trustedClientIp } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(20).max(256),
  password: z.string().min(8).max(128),
});

function invalidLinkResponse() {
  return NextResponse.json(
    { reset: false, error: "Invalid or expired reset link" },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidLinkResponse();

  const tokenLimit = consumeRateLimit({
    namespace: "password-reset-token",
    identifier: parsed.data.token,
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!tokenLimit.allowed) return rateLimitResponse(tokenLimit.retryAfterSeconds);

  const clientIp = trustedClientIp(request);
  if (clientIp) {
    const ipLimit = consumeRateLimit({
      namespace: "password-reset-consume-ip",
      identifier: clientIp,
      maxAttempts: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);
  }

  const token = await findAuthToken("reset", parsed.data.token);
  if (!token) return invalidLinkResponse();

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
  const sessionVersion = createCredentialSessionVersion();
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.verificationToken.deleteMany({
        where: {
          identifier: token.identifier,
          token: token.token,
          expires: { gt: now },
        },
      });
      if (consumed.count !== 1) throw new Error("RESET_TOKEN_CONSUMED");

      // Anonymous recovery requests may issue several still-valid links. Once
      // one succeeds, retire every sibling reset link in this transaction.
      await tx.verificationToken.deleteMany({
        where: { identifier: token.identifier },
      });

      const updated = await tx.account.updateMany({
        where: { userId: token.userId, provider: "credentials" },
        data: {
          accessToken: hashedPassword,
          // Rotating this private version invalidates JWT sessions issued with
          // the old password on their next authenticated server request.
          refreshToken: sessionVersion,
        },
      });
      if (updated.count !== 1) throw new Error("RESET_ACCOUNT_MISSING");

      // A valid reset link also proves control of the mailbox.
      await tx.verificationToken.deleteMany({
        where: { identifier: `verify:${token.userId}` },
      });

      // Defensive cleanup if the session strategy changes later.
      await tx.session.deleteMany({ where: { userId: token.userId } });
    });
  } catch (error) {
    const known = error instanceof Error &&
      (error.message === "RESET_TOKEN_CONSUMED" || error.message === "RESET_ACCOUNT_MISSING");
    if (known) return invalidLinkResponse();

    console.error("auth_password_reset_failed", {
      code: "password_reset_failed",
    });
    return NextResponse.json(
      { reset: false, error: "Unable to reset password" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { reset: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
