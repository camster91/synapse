import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { encryptSecret } from "@/lib/security/secrets";

const updateSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  timezone: z.string().max(100).optional(),
  avatarUrl: z.string().max(2000).nullable().optional(),
  anthropicApiKey: z.string().max(200).optional(),
  openaiApiKey: z.string().max(200).optional(),
  preferredAiProvider: z.enum(["anthropic", "openai", "ollama"]).optional(),
}).strict();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
          name: true, email: true, timezone: true, avatarUrl: true,
          anthropicApiKey: true, openaiApiKey: true, ollamaBaseUrl: true, preferredAiProvider: true,
        },
      });
    }

    // Never return API keys in any form — only expose whether they are configured
    return NextResponse.json({
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      avatarUrl: user.avatarUrl,
      preferredAiProvider: user.preferredAiProvider,
      hasAnthropicKey: Boolean(user.anthropicApiKey),
      hasOpenaiKey: Boolean(user.openaiApiKey),
      ollamaAvailable: Boolean(process.env.OLLAMA_BASE_URL),
    });
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = updateSettingsSchema.parse(body);

    // If email is changing, check it's not already taken
    if (data.email) {
      const existing = await prisma.user.findFirst({
        where: {
          email: data.email,
          id: { not: session.user.id },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Email is already in use" },
          { status: 409 }
        );
      }
    }

    const encryptionKey = process.env.SYNAPSE_ENCRYPTION_KEY;
    if ((data.anthropicApiKey || data.openaiApiKey) && !encryptionKey) {
      return NextResponse.json(
        { error: "AI key storage is unavailable. Contact the beta administrator." },
        { status: 503 }
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
        // else: "****" or undefined — skip, keep existing
      } else if (value !== undefined) {
        updateData[key] = value;
      }
    }

    const user = await prisma.user.update({
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
      },
    });

    // Never return API keys in the response — only expose whether they are configured
    return NextResponse.json({
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      avatarUrl: user.avatarUrl,
      preferredAiProvider: user.preferredAiProvider,
      hasAnthropicKey: Boolean(user.anthropicApiKey),
      hasOpenaiKey: Boolean(user.openaiApiKey),
      ollamaAvailable: Boolean(process.env.OLLAMA_BASE_URL),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
