import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pluginRegistry } from "@/lib/plugins/registry";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const installedOnly = searchParams.get("installed") === "true";

  if (installedOnly) {
    // Return the user's installed plugins with their manifest data
    const userPlugins = await pluginRegistry.getUserPlugins(session.user.id);
    return NextResponse.json(userPlugins);
  }

  // Return all available plugins from the registry
  const allPlugins = pluginRegistry.getAllPlugins();
  return NextResponse.json(allPlugins);
}