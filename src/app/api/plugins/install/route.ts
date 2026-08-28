import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pluginRegistry } from "@/lib/plugins/registry";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { pluginName } = body as { pluginName?: string };

    if (!pluginName) {
      return NextResponse.json(
        { error: "pluginName is required" },
        { status: 400 }
      );
    }

    // Verify plugin exists in registry
    const manifest = pluginRegistry.getPlugin(pluginName);
    if (!manifest) {
      return NextResponse.json(
        { error: `Plugin "${pluginName}" not found` },
        { status: 404 }
      );
    }

    // Upsert the Plugin record in the database
    // JSON fields require casting through unknown for Prisma compatibility
    const pluginRecord = await prisma.plugin.upsert({
      where: { name: pluginName },
      update: {
        displayName: manifest.displayName,
        description: manifest.description ?? null,
        version: manifest.version,
        author: manifest.author ?? null,
        icon: manifest.icon ?? null,
        homepage: manifest.homepage ?? null,

        permissions: manifest.permissions as any,

        configSchema: (manifest.configSchema ?? {}) as any,
      },
      create: {
        name: manifest.name,
        displayName: manifest.displayName,
        description: manifest.description ?? null,
        version: manifest.version,
        author: manifest.author ?? null,
        icon: manifest.icon ?? null,
        homepage: manifest.homepage ?? null,

        permissions: manifest.permissions as any,

        configSchema: (manifest.configSchema ?? {}) as any,
      },
    });

    // Create the UserPlugin record
    const userPlugin = await prisma.userPlugin.upsert({
      where: {
        userId_pluginId: {
          userId: session.user.id,
          pluginId: pluginRecord.id,
        },
      },
      update: {
        enabled: true,
      },
      create: {
        userId: session.user.id,
        pluginId: pluginRecord.id,
        enabled: true,
        config: {},
      },
    });

    return NextResponse.json({ userPlugin }, { status: 201 });
  } catch (error) {
    console.error("Failed to install plugin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}