import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addXp } from "@/lib/xp";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { consumeRateLimit, rateLimitResponse, trustedClientIp } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

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

    // Always perform the password work before the existence branch so the API
    // does not expose registered accounts through response timing.
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json({ accepted: true }, { status: 201 });
    }

    // Create User + Account in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          lastActiveAt: new Date(),
        },
      });

      await tx.account.create({
        data: {
          userId: newUser.id,
          provider: "credentials",
          providerAccountId: data.email,
          accessToken: hashedPassword,
        },
      });

      return newUser;
    });

    // Award "first steps" achievement
    try {
      // Ensure the achievement record exists
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
          userId: user.id,
          achievementId: achievementRecord.id,
        },
      });

      await addXp(user.id, 25, "achievement:first_steps");
    } catch (err) {
      // Achievement award is non-critical — log but don't fail registration
      console.error("Failed to award first_steps achievement:", err);
    }

    // Return user data without password
    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Failed to register user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
