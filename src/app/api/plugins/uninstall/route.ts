import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    // Find the plugin record
    const pluginRecord = await prisma.plugin.findUnique({
      where: { name: pluginName },
    });

    if (!pluginRecord) {
      return NextResponse.json(
        { error: `Plugin "${pluginName}" not found` },
        { status: 404 }
      );
    }

    // Delete the UserPlugin record
    const deleted = await prisma.userPlugin.deleteMany({
      where: {
        userId: session.user.id,
        pluginId: pluginRecord.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Plugin was not installed for this user" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to uninstall plugin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}