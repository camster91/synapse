import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addXp } from '@/lib/xp';
import { fireHookForUser } from '@/lib/plugins/executor';
import { z } from 'zod/v4';

const createJournalSchema = z.object({
  date: z.string(), // ISO date string
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
    const date = new Date(journalData.date);
    date.setHours(0, 0, 0, 0);

    // Upsert by userId + date
    const isNew = !(await prisma.journal.findUnique({
      where: { userId_date: { userId: session.user.id, date } },
    }));

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
    console.error('Failed to create/update journal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}