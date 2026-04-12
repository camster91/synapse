import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const contains = { contains: q, mode: "insensitive" as const };

  try {
    const [todos, notes, journals, goals, events] = await Promise.all([
      prisma.todo.findMany({
        where: {
          userId,
          OR: [{ title: contains }, { description: contains }],
        },
        take: 10,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          updatedAt: true,
        },
      }),

      prisma.note.findMany({
        where: {
          userId,
          OR: [{ title: contains }, { content: contains }],
        },
        take: 10,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          icon: true,
          updatedAt: true,
        },
      }),

      prisma.journal.findMany({
        where: {
          userId,
          content: contains,
        },
        take: 10,
        orderBy: { date: "desc" },
        select: {
          id: true,
          date: true,
          content: true,
          mood: true,
        },
      }),

      prisma.goal.findMany({
        where: {
          userId,
          title: contains,
        },
        take: 10,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          level: true,
          progress: true,
        },
      }),

      prisma.calendarEvent.findMany({
        where: {
          userId,
          title: contains,
        },
        take: 10,
        orderBy: { startAt: "desc" },
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          allDay: true,
        },
      }),
    ]);

    return NextResponse.json({
      todos,
      notes,
      journals,
      goals,
      events,
    });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}