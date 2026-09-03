import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { undoAdaptiveChange } from "@/lib/adaptive-storage";

const inputSchema = z.object({ changeId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid adaptive undo request" }, { status: 400 });
  }

  try {
    const result = await undoAdaptiveChange({
      userId: session.user.id,
      changeId: parsed.data.changeId,
    });
    return NextResponse.json(
      { undone: true, changeId: parsed.data.changeId, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adaptive undo failed";
    const conflict = /expired|conflict|newer|already|not found/i.test(message);
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 500 });
  }
}
