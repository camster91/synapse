import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InvalidRelationshipError, validateOwnedRelationships } from '@/lib/ownership';
import { isoDateTimeSchema, recurrenceSchema } from '@/lib/date-validation';
import { stageFilesForDeletion } from '@/lib/upload';
import { z } from 'zod/v4';

const updateEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  startAt: isoDateTimeSchema.optional(),
  endAt: isoDateTimeSchema.nullable().optional(),
  allDay: z.boolean().optional(),
  recurrence: recurrenceSchema.nullable().optional(),
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

    const existing = await prisma.calendarEvent.findFirst({
      where: { id, userId: session.user.id },
      select: { startAt: true, endAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const nextStart = data.startAt ? new Date(data.startAt) : existing.startAt;
    const nextEnd = data.endAt === undefined
      ? existing.endAt
      : data.endAt
        ? new Date(data.endAt)
        : null;
    if (nextEnd && nextEnd <= nextStart) {
      return NextResponse.json(
        { error: 'Event end must be after its start' },
        { status: 400 }
      );
    }

    const { tagIds, ...eventData } = data;
    await validateOwnedRelationships(session.user.id, { tagIds });

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
    if (error instanceof InvalidRelationshipError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
    const attachments = await prisma.attachment.findMany({
      where: { calendarEventId: id, userId: session.user.id },
      select: { url: true },
    });
    const stagedFiles = await stageFilesForDeletion(attachments.map(({ url }) => url));
    try {
      await prisma.calendarEvent.delete({ where: { id, userId: session.user.id } });
    } catch (error) {
      await stagedFiles.rollback();
      throw error;
    }
    await stagedFiles.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    console.error('Failed to delete calendar event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
