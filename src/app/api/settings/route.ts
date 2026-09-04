import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { encryptSecret } from "@/lib/security/secrets";

const noStoreHeaders = { "Cache-Control": "no-store" };

const updateSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  timezone: z.string().max(100).optional(),
  avatarUrl: z.string().max(2000).nullable().optional(),
  anthropicApiKey: z.string().max(200).optional(),
  openaiApiKey: z.string().max(200).optional(),
  preferredAiProvider: z.enum(["anthropic", "openai", "ollama"]).optional(),
  productAnalyticsConsent: z.boolean().optional(),
}).strict();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  try {
    let user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        timezone: true,
        avatarUrl: true,
        anthropicApiKey: true,
        openaiApiKey: true,
        ollamaBaseUrl: true,
        preferredAiProvider: true,
        productAnalyticsConsent: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: noStoreHeaders },
      );
    }

    const encryptionKey = process.env.SYNAPSE_ENCRYPTION_KEY;
    const legacyUpdates: Record<string, string> = {};
    if (encryptionKey) {
      if (user.anthropicApiKey && !user.anthropicApiKey.startsWith("v1:")) {
        legacyUpdates.anthropicApiKey = encryptSecret(user.anthropicApiKey, encryptionKey);
      }
      if (user.openaiApiKey && !user.openaiApiKey.startsWith("v1:")) {
        legacyUpdates.openaiApiKey = encryptSecret(user.openaiApiKey, encryptionKey);
      }
    }
    if (Object.keys(legacyUpdates).length > 0) {
      user = await prisma.user.update({
        where: { id: session.user.id },
        data: legacyUpdates,
        select: {
          name: true,
          email: true,
          timezone: true,
          avatarUrl: true,
          anthropicApiKey: true,
          openaiApiKey: true,
          ollamaBaseUrl: true,
          preferredAiProvider: true,
          productAnalyticsConsent: true,
        },
      });
    }

    return NextResponse.json(
      {
        name: user.name,
        email: user.email,
        timezone: user.timezone,
        avatarUrl: user.avatarUrl,
        preferredAiProvider: user.preferredAiProvider,
        hasAnthropicKey: Boolean(user.anthropicApiKey),
        hasOpenaiKey: Boolean(user.openaiApiKey),
        ollamaAvailable: Boolean(process.env.OLLAMA_BASE_URL),
        productAnalyticsConsent: user.productAnalyticsConsent,
      },
      { headers: noStoreHeaders },
    );
  } catch {
    console.error("settings_fetch_failed", { code: "settings_fetch_failed" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  try {
    const body = await request.json();
    const data = updateSettingsSchema.parse(body);

    if (data.email) {
      const currentIdentity = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      });
      if (!currentIdentity) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404, headers: noStoreHeaders },
        );
      }

      const requestedEmail = data.email.trim().toLowerCase();
      const currentEmail = currentIdentity.email.trim().toLowerCase();
      if (requestedEmail !== currentEmail) {
        return NextResponse.json(
          {
            error: "Email changes require verification and are unavailable during the managed beta.",
            code: "EMAIL_CHANGE_REQUIRES_VERIFICATION",
          },
          { status: 409, headers: noStoreHeaders },
        );
      }

      // Preserve the stored identity exactly for case-only/no-op submissions.
      data.email = currentIdentity.email;
    }

    const encryptionKey = process.env.SYNAPSE_ENCRYPTION_KEY;
    if ((data.anthropicApiKey || data.openaiApiKey) && !encryptionKey) {
      return NextResponse.json(
        { error: "AI key storage is unavailable. Contact the beta administrator." },
        { status: 503, headers: noStoreHeaders },
      );
    }

    // API keys are encrypted before persistence and are never returned to clients.
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === "anthropicApiKey" || key === "openaiApiKey") {
        if (typeof value === "string" && value.startsWith("sk-") && value.length > 4) {
          updateData[key] = encryptSecret(value, encryptionKey!);
        } else if (value === "" || value === null) {
          updateData[key] = null;
        }
        // "****" or undefined keeps the existing value.
      } else if (value !== undefined) {
        updateData[key] = value;
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: session.user.id },
        data: updateData,
        select: {
          name: true,
          email: true,
          timezone: true,
          avatarUrl: true,
          anthropicApiKey: true,
          openaiApiKey: true,
          ollamaBaseUrl: true,
          preferredAiProvider: true,
          productAnalyticsConsent: true,
        },
      });
      if (data.productAnalyticsConsent === false) {
        await tx.productEvent.deleteMany({ where: { userId: session.user.id } });
      }
      return updated;
    });

    return NextResponse.json(
      {
        name: user.name,
        email: user.email,
        timezone: user.timezone,
        avatarUrl: user.avatarUrl,
        preferredAiProvider: user.preferredAiProvider,
        hasAnthropicKey: Boolean(user.anthropicApiKey),
        hasOpenaiKey: Boolean(user.openaiApiKey),
        ollamaAvailable: Boolean(process.env.OLLAMA_BASE_URL),
        productAnalyticsConsent: user.productAnalyticsConsent,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400, headers: noStoreHeaders },
      );
    }
    console.error("settings_update_failed", { code: "settings_update_failed" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
