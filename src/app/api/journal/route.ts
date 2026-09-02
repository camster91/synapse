import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addXp } from '@/lib/xp';
import { fireHookForUser } from '@/lib/plugins/executor';
import { z } from 'zod/v4';
import { dateOnlyToUtc, isoDateOrDateTimeSchema, isoDateSchema } from '@/lib/date-validation';
import { InvalidRelationshipError, validateOwnedRelationships } from '@/lib/ownership';

const createJournalSchema = z.object({
  date: isoDateSchema,
  content: z.string().max(100000),
  mood: z.int().min(1).max(10).optional(),
  gratitude: z.string().max(5000).optional(),
  highlights: z.string().max(5000).optional(),
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

  const parsedFrom = from ? isoDateOrDateTimeSchema.safeParse(from) : null;
  const parsedTo = to ? isoDateOrDateTimeSchema.safeParse(to) : null;
  if ((parsedFrom && !parsedFrom.success) || (parsedTo && !parsedTo.success)) {
    return NextResponse.json({ error: 'Invalid journal date range' }, { status: 400 });
  }
  if (from && to && new Date(from) > new Date(to)) {
    return NextResponse.json({ error: 'Journal range start must precede its end' }, { status: 400 });
  }

  const where: any = { userId: session.user.id };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const journals = await prisma.journal.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { tags: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json(journals);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createJournalSchema.parse(body);

    const { tagIds, ...journalData } = data;
    await validateOwnedRelationships(session.user.id, { tagIds });
    const date = dateOnlyToUtc(journalData.date);

    // Upsert by userId + date — determine isNew from the result to avoid race condition
    const journal = await prisma.journal.upsert({
      where: { userId_date: { userId: session.user.id, date } },
      update: {
        content: journalData.content,
        mood: journalData.mood,
        gratitude: journalData.gratitude,
        highlights: journalData.highlights,
        ...(tagIds !== undefined
          ? { tags: { set: tagIds.map((tid: string) => ({ id: tid })) } }
          : {}),
      },
      create: {
        userId: session.user.id,
        date,
        content: journalData.content,
        mood: journalData.mood,
        gratitude: journalData.gratitude,
        highlights: journalData.highlights,
        ...(tagIds && tagIds.length > 0
          ? { tags: { connect: tagIds.map((id: string) => ({ id })) } }
          : {}),
      },
      include: { tags: true },
    });

    // If createdAt and updatedAt are within the same second, this was a create
    const isNew = Math.abs(journal.createdAt.getTime() - journal.updatedAt.getTime()) < 1000;

    // Award XP for journal entry (only for new entries)
    if (isNew) {
      await addXp(session.user.id, 15, 'journal_entry', journal.id);
    }

    // Fire plugin hook
    try {
      await fireHookForUser(session.user.id, 'onJournalEntry', journal);
    } catch (hookErr) {
      console.error('Plugin hook onJournalEntry failed:', hookErr);
    }

    return NextResponse.json(journal, { status: isNew ? 201 : 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    if (error instanceof InvalidRelationshipError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create/update journal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
