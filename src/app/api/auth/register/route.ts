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

function acceptedResponse() {
  return NextResponse.json(
    { accepted: true },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  );
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
      console.error("auth_email_delivery_failed", {
        type: "verification",
        provider: "resend",
        code: authEmailErrorCode(error),
      });
    }
  });
}

function scheduleExistingVerification(email: string) {
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
      if (!user || user.accounts.length === 0 || !await hasPendingVerification(user.id)) {
        return;
      }

      const token = await createAuthToken("verify", user.id);
      await sendVerificationEmail({
        email: user.email,
        rawToken: token.rawToken,
        tokenHash: token.token,
      });
    } catch (error) {
      console.error("auth_verification_issue_failed", {
        code: authEmailErrorCode(error),
      });
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

    // Perform password work before the account-existence branch so a public
    // response does not cheaply disclose a registered email through timing.
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
        scheduleExistingVerification(data.email);
      }
      return acceptedResponse();
    }

    let created: {
      user: { id: string; email: string };
      verificationToken: ReturnType<typeof generateAuthToken>;
    };

    try {
      created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: data.email,
            name: data.name,
            lastActiveAt: new Date(),
          },
          select: { id: true, email: true },
        });

        await tx.account.create({
          data: {
            userId: user.id,
            provider: "credentials",
            providerAccountId: data.email,
            accessToken: hashedPassword,
            // Credentials accounts use refreshToken only as a private session
            // invalidation version; it is never sent to an external provider.
            refreshToken: createCredentialSessionVersion(),
          },
        });

        // This row is both the hashed one-time token and the durable
        // unverified-account marker. Link expiry must not activate the account.
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
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // A concurrent registration may have won after the initial lookup.
        // Preserve the same response and schedule the same safe resend path.
        scheduleExistingVerification(data.email);
        return acceptedResponse();
      }
      throw error;
    }

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

    return acceptedResponse();
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
