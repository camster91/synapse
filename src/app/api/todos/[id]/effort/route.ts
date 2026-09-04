import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const minutesSchema = z.number().int().min(1).max(10_080).nullable();
const inputSchema = z.object({
  estimatedMinutes: minutesSchema.optional(),
  minimumMinutes: minutesSchema.optional(),
}).refine(
  (value) => value.estimatedMinutes !== undefined || value.minimumMinutes !== undefined,
  { message: "At least one effort field is required" },
);

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid effort values" }, { status: 400 });
  }

  const { id } = await params;
  const existing = await prisma.todo.findFirst({
    where: { id, userId: session.user.id },
    select: { estimatedMinutes: true, minimumMinutes: true, updatedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  const estimatedMinutes = parsed.data.estimatedMinutes === undefined
    ? existing.estimatedMinutes
    : parsed.data.estimatedMinutes;
  let minimumMinutes = parsed.data.minimumMinutes === undefined
    ? existing.minimumMinutes
    : parsed.data.minimumMinutes;

  if (estimatedMinutes === null) minimumMinutes = null;
  if (minimumMinutes !== null && (estimatedMinutes === null || minimumMinutes > estimatedMinutes)) {
    return NextResponse.json(
      { error: "Minimum effort must be less than or equal to the estimate" },
      { status: 400 },
    );
  }

  const updated = await prisma.todo.updateMany({
    where: { id, userId: session.user.id, updatedAt: existing.updatedAt },
    data: { estimatedMinutes, minimumMinutes },
  });
  if (updated.count !== 1) {
    return NextResponse.json(
      { error: "This task changed while you were editing it. Refresh and try again." },
      { status: 409 },
    );
  }
  const todo = await prisma.todo.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, estimatedMinutes: true, minimumMinutes: true, updatedAt: true },
  });

  return NextResponse.json(todo, { headers: { "Cache-Control": "no-store" } });
}
