import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fireHookForUser } from '@/lib/plugins/executor';
import { z } from 'zod/v4';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

const createNoteSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(100000).default(''),
  slug: z.string().max(200).optional(),
  icon: z.string().max(50).optional(),
  coverImage: z.string().max(2000).optional(),
  parentId: z.string().nullable().optional(),
  isPublished: z.boolean().default(false),
  sortOrder: z.int().default(0),
  tagIds: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const parentId = searchParams.get('parentId');
  const archived = searchParams.get('archived') === 'true';

  const where: any = { userId: session.user.id, archived };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (parentId !== null) {
    where.parentId = parentId === 'null' ? null : parentId;
  }

  const notes = await prisma.note.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    include: {
      tags: { select: { id: true, name: true, color: true } },
      _count: { select: { children: true } },
    },
  });

  return NextResponse.json(notes);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createNoteSchema.parse(body);

    const { tagIds, ...noteData } = data;
    const slug = data.slug ?? slugify(data.title);

    // Ensure slug uniqueness
    const existing = await prisma.note.findFirst({
      where: { userId: session.user.id, slug },
    });
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    const note = await prisma.note.create({
      data: {
        ...noteData,
        slug: finalSlug,
        publishedAt: data.isPublished ? new Date() : undefined,
        userId: session.user.id,
        ...(tagIds && tagIds.length > 0
          ? { tags: { connect: tagIds.map((id: string) => ({ id })) } }
          : {}),
      },
      include: { tags: true },
    });

    // Fire plugin hook
    try {
      await fireHookForUser(session.user.id, 'onNoteCreated', note);
    } catch (hookErr) {
      console.error('Plugin hook onNoteCreated failed:', hookErr);
    }

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('Failed to create note:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}