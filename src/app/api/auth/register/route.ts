import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { addXp } from "@/lib/xp";
import {
  createAuthToken,
  createCredentialSessionVersion,
  generateAuthToken,
  hasPendingVerification,
} from "@/lib/auth-tokens";
import { emailDeliveryConfigured, sendVerificationEmail } from "@/lib/email";
import { consumeRateLimit, rateLimitResponse, trustedClientIp } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

async function sendExistingVerification(userId: string, email: string) {
  const token = await createAuthToken("verify", userId);
  try {
    await sendVerificationEmail({
      email,
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

export async function POST(request: Request) {
  try {
    if (!emailDeliveryConfigured()) {
      return NextResponse.json(
        { error: "Email delivery is not configured" },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = registerSchema.parse(body);
    const data = {
      ...parsed,
      email: parsed.email.trim().toLowerCase(),
      name: parsed.name.trim(),
    };

    const accountLimit = consumeRateLimit({
      namespace: "register-account",
      identifier: data.email,
      maxAttempts: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!accountLimit.allowed) return rateLimitResponse(accountLimit.retryAfterSeconds);

    const clientIp = trustedClientIp(request);
    if (clientIp) {
      const ipLimit = consumeRateLimit({
        namespace: "register-ip",
        identifier: clientIp,
        maxAttempts: 10,
        windowMs: 60 * 60 * 1000,
      });
      if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);
    }

    // Always do password work before the existence branch so the public timing
    // contract does not cheaply expose registered accounts.
    const hashedPassword = await bcrypt.hash(data.password, 12);
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        accounts: {
          where: { provider: "credentials" },
          select: { id: true },
        },
      },
    });

    if (existingUser) {
      if (existingUser.accounts.length > 0 && await hasPendingVerification(existingUser.id)) {
        await sendExistingVerification(existingUser.id, existingUser.email);
      }
      return NextResponse.json({ accepted: true }, { status: 201 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          lastActiveAt: new Date(),
        },
      });

      await tx.account.create({
        data: {
          userId: user.id,
          provider: "credentials",
          providerAccountId: data.email,
          accessToken: hashedPassword,
          // Credentials accounts use refreshToken only as a random session
          // invalidation version; it is never sent to an external provider.
          refreshToken: createCredentialSessionVersion(),
        },
      });

      // Absence of this marker means a credentials account is verified, so the
      // marker must be committed atomically with the new account.
      const verificationToken = generateAuthToken("verify", user.id);
      await tx.verificationToken.create({
        data: {
          identifier: verificationToken.identifier,
          token: verificationToken.token,
          expires: verificationToken.expires,
        },
      });

      return { user, verificationToken };
    });

    try {
      await sendVerificationEmail({
        email: created.user.email,
        rawToken: created.verificationToken.rawToken,
        tokenHash: created.verificationToken.token,
      });
    } catch (error) {
      console.error("auth_email_delivery_failed", {
        type: "verification",
        provider: "resend",
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    try {
      const achievementRecord = await prisma.achievement.upsert({
        where: { key: "first_steps" },
        update: {},
        create: {
          key: "first_steps",
          name: "First Steps",
          description: "Create your account and start your journey",
          icon: "footprints",
          category: "explorer",
          xpReward: 25,
        },
      });

      await prisma.userAchievement.create({
        data: {
          userId: created.user.id,
          achievementId: achievementRecord.id,
        },
      });
      await addXp(created.user.id, 25, "achievement:first_steps");
    } catch (error) {
      console.error("Failed to award first_steps achievement:", error);
    }

    // Intentionally do not return account-specific data.
    return NextResponse.json({ accepted: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Failed to register user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
