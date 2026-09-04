import { after, NextResponse } from "next/server";
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
import {
  authEmailErrorCode,
  emailDeliveryConfigured,
  sendVerificationEmail,
} from "@/lib/email";
import { consumeRateLimit, rateLimitResponse, trustedClientIp } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

function logDeliveryFailure(error: unknown) {
  console.error("auth_email_delivery_failed", {
    type: "verification",
    provider: "resend",
    code: authEmailErrorCode(error),
  });
}

function scheduleVerificationEmail(input: {
  email: string;
  rawToken: string;
  tokenHash: string;
}) {
  after(async () => {
    try {
      await sendVerificationEmail(input);
    } catch (error) {
      logDeliveryFailure(error);
    }
  });
}

export async function POST(request: Request) {
  try {
    if (!emailDeliveryConfigured()) {
      return NextResponse.json(
        { error: "Email delivery is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const parsed = registerSchema.parse(await request.json());
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
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" } },
      include: {
        accounts: {
          where: { provider: "credentials" },
          select: { id: true },
        },
      },
    });

    if (existingUser) {
      if (existingUser.accounts.length > 0 && await hasPendingVerification(existingUser.id)) {
        try {
          const token = await createAuthToken("verify", existingUser.id);
          scheduleVerificationEmail({
            email: existingUser.email,
            rawToken: token.rawToken,
            tokenHash: token.token,
          });
        } catch {
          // Keep token-state failures out of the account-existence response.
          console.error("auth_verification_issue_failed", {
            code: "token_issue_failed",
          });
        }
      }

      return NextResponse.json(
        { accepted: true },
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
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

      // The verification record is also the durable unverified-account marker.
      // Expiry invalidates the link but does not permit sign-in; resend replaces it.
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

    scheduleVerificationEmail({
      email: created.user.email,
      rawToken: created.verificationToken.rawToken,
      tokenHash: created.verificationToken.token,
    });

    after(async () => {
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
      } catch {
        console.error("auth_registration_achievement_failed", {
          code: "achievement_award_failed",
        });
      }
    });

    return NextResponse.json(
      { accepted: true },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("auth_registration_failed", { code: "registration_failed" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
