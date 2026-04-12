import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod/v4';

const updateEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  startAt: z.string().optional(),
  endAt: z.string().nullable().optional(),
  allDay: z.boolean().optional(),
  recurrence: z.string().nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateEventSchema.parse(body);

    const { tagIds, ...eventData } = data;

    const updateData: any = { ...eventData };
    if (eventData.startAt) updateData.startAt = new Date(eventData.startAt);
    if (eventData.endAt !== undefined) {
      updateData.endAt = eventData.endAt ? new Date(eventData.endAt) : null;
    }

    const event = await prisma.calendarEvent.update({
      where: { id, userId: session.user.id },
      data: {
        ...updateData,
        ...(tagIds !== undefined
          ? { tags: { set: tagIds.map((tid: string) => ({ id: tid })) } }
          : {}),
      },
      include: { tags: true },
    });

    return NextResponse.json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    console.error('Failed to update calendar event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.calendarEvent.delete({ where: { id, userId: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    console.error('Failed to delete calendar event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}