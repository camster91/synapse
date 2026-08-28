import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InvalidRelationshipError, validateOwnedRelationships } from '@/lib/ownership';
import { isoDateTimeSchema, recurrenceSchema } from '@/lib/date-validation';
import { z } from 'zod/v4';

const createEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  location: z.string().max(500).optional(),
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema.optional(),
  allDay: z.boolean().default(false),
  recurrence: recurrenceSchema.optional(),
  color: z.string().max(20).optional(),
  source: z.string().max(50).default('manual'),
  externalId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const parsedFrom = from ? isoDateTimeSchema.safeParse(from) : null;
  const parsedTo = to ? isoDateTimeSchema.safeParse(to) : null;
  if ((parsedFrom && !parsedFrom.success) || (parsedTo && !parsedTo.success)) {
    return NextResponse.json({ error: 'Invalid calendar date range' }, { status: 400 });
  }
  if (from && to && new Date(from) > new Date(to)) {
    return NextResponse.json({ error: 'Calendar range start must precede its end' }, { status: 400 });
  }

  const where: any = { userId: session.user.id };
  if (from || to) {
    where.startAt = {};
    if (from) where.startAt.gte = new Date(from);
    if (to) where.startAt.lte = new Date(to);
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startAt: 'asc' },
    include: { tags: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createEventSchema.parse(body);

    if (data.endAt && new Date(data.endAt) <= new Date(data.startAt)) {
      return NextResponse.json(
        { error: 'Event end must be after its start' },
        { status: 400 }
      );
    }

    const { tagIds, ...eventData } = data;
    await validateOwnedRelationships(session.user.id, { tagIds });

    const event = await prisma.calendarEvent.create({
      data: {
        ...eventData,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : undefined,
        userId: session.user.id,
        ...(tagIds && tagIds.length > 0
          ? { tags: { connect: tagIds.map((id: string) => ({ id })) } }
          : {}),
      },
      include: { tags: true },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    if (error instanceof InvalidRelationshipError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create calendar event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
