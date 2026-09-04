import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import {
  createCredentialSessionVersion,
  findAuthToken,
} from "@/lib/auth-tokens";

const schema = z.object({
  token: z.string().min(20).max(256),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ reset: false, error: "Invalid or expired reset link" }, { status: 400 });
  }

  const token = await findAuthToken("reset", parsed.data.token);
  if (!token) {
    return NextResponse.json({ reset: false, error: "Invalid or expired reset link" }, { status: 400 });
  }

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

      const updated = await tx.account.updateMany({
        where: { userId: token.userId, provider: "credentials" },
        data: {
          accessToken: hashedPassword,
          // Rotating this value invalidates JWT sessions issued with the old
          // credentials version on their next authenticated request.
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
    if (known) {
      return NextResponse.json({ reset: false, error: "Invalid or expired reset link" }, { status: 400 });
    }
    console.error("Password reset failed:", error);
    return NextResponse.json({ reset: false, error: "Unable to reset password" }, { status: 500 });
  }

  return NextResponse.json(
    { reset: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
