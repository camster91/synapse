import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pluginRegistry } from "@/lib/plugins/registry";
import { z } from "zod/v4";
import type { ConfigFieldDefinition } from "@/lib/plugins/types";

const configureSchema = z.object({
  pluginName: z.string().min(1),
  config: z.record(z.string(), z.any()),
});

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = configureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { pluginName, config } = parsed.data;

    // Verify plugin exists
    const manifest = pluginRegistry.getPlugin(pluginName);
    if (!manifest) {
      return NextResponse.json(
        { error: `Plugin "${pluginName}" not found` },
        { status: 404 }
      );
    }

    // Validate config against configSchema
    if (manifest.configSchema) {
      for (const [key, fieldDef] of Object.entries(
        manifest.configSchema as Record<string, ConfigFieldDefinition>
      )) {
        const value = config[key];

        if (
          fieldDef.required &&
          (value === undefined || value === null || value === "")
        ) {
          return NextResponse.json(
            { error: `Config field "${key}" is required` },
            { status: 400 }
          );
        }

        if (value !== undefined && value !== null) {
          switch (fieldDef.type) {
            case "string":
              if (typeof value !== "string") {
                return NextResponse.json(
                  { error: `Config field "${key}" must be a string` },
                  { status: 400 }
                );
              }
              break;
            case "number":
              if (typeof value !== "number") {
                return NextResponse.json(
                  { error: `Config field "${key}" must be a number` },
                  { status: 400 }
                );
              }
              break;
            case "boolean":
              if (typeof value !== "boolean") {
                return NextResponse.json(
                  { error: `Config field "${key}" must be a boolean` },
                  { status: 400 }
                );
              }
              break;
            case "select":
              if (
                fieldDef.options &&
                !fieldDef.options.includes(String(value))
              ) {
                return NextResponse.json(
                  {
                    error: `Config field "${key}" must be one of: ${fieldDef.options.join(", ")}`,
                  },
                  { status: 400 }
                );
              }
              break;
          }
        }
      }
    }

    // Find the plugin record
    const pluginRecord = await prisma.plugin.findUnique({
      where: { name: pluginName },
    });

    if (!pluginRecord) {
      return NextResponse.json(
        { error: `Plugin "${pluginName}" not found in database` },
        { status: 404 }
      );
    }

    // Update the UserPlugin config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userPlugin = await prisma.userPlugin.update({
      where: {
        userId_pluginId: {
          userId: session.user.id,
          pluginId: pluginRecord.id,
        },
      },
      data: {
        config: config as any,
      },
    });

    return NextResponse.json({ userPlugin });
  } catch (error) {
    console.error("Failed to configure plugin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}