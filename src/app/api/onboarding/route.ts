import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { localDayKey } from "@/lib/product-metrics";

const onboardingSchema = z
  .object({
    skip: z.boolean().default(false),
    goal: z.string().trim().max(500).optional(),
    habit: z.string().trim().max(200).optional(),
    task: z.string().trim().max(500).optional(),
    productAnalyticsConsent: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.skip && !data.task) {
      ctx.addIssue({
        code: "custom",
        path: ["task"],
        message: "Add one priority task or skip setup for now",
      });
    }
  });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingComplete: true },
  });

  return NextResponse.json({ complete: user?.onboardingComplete ?? false });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = onboardingSchema.parse(await request.json());

    await prisma.$transaction(async (tx) => {
      let goalId: string | undefined;

      if (!data.skip && data.goal) {
        const goal = await tx.goal.create({
          data: {
            userId: session.user.id,
            title: data.goal,
            level: "QUARTERLY",
          },
        });
        goalId = goal.id;
      }

      if (!data.skip && data.habit) {
        await tx.habit.create({
          data: {
            userId: session.user.id,
            name: data.habit,
            frequency: "DAILY",
          },
        });
      }

      if (!data.skip && data.task) {
        await tx.todo.create({
          data: {
            userId: session.user.id,
            title: data.task,
            status: "TODO",
            priority: 3,
            goalId,
          },
        });
      }

      await tx.user.update({
        where: { id: session.user.id },
        data: {
          onboardingComplete: true,
          productAnalyticsConsent: data.productAnalyticsConsent,
        },
      });

      if (data.productAnalyticsConsent && !data.skip && data.task) {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: session.user.id },
          select: { timezone: true },
        });
        const occurredAt = new Date();
        await tx.productEvent.create({
          data: {
            userId: session.user.id,
            name: "FIRST_PLAN_CREATED",
            dayKey: localDayKey(occurredAt, user.timezone),
            occurredAt,
          },
        });
      }
    });

    return NextResponse.json({ complete: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Failed to complete onboarding:", error);
    return NextResponse.json({ error: "Setup could not be saved" }, { status: 500 });
  }
}
