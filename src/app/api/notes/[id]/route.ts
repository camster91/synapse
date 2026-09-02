import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InvalidRelationshipError, validateOwnedRelationships } from '@/lib/ownership';
import { stageFilesForDeletion } from '@/lib/upload';
import { releaseUploadCapacity } from '@/lib/upload-quota';
import { z } from 'zod/v4';

const updateNoteSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(100000).optional(),
  slug: z.string().max(200).optional(),
  icon: z.string().max(50).nullable().optional(),
  coverImage: z.string().max(2000).nullable().optional(),
  parentId: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.int().optional(),
  archived: z.boolean().optional(),
  tagIds: z.array(z.string()).optional(),
});

function extractWikilinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const note = await prisma.note.findFirst({
    where: { id, userId: session.user.id },
    include: {
      tags: true,
      children: { orderBy: { sortOrder: 'asc' } },
      backlinks: {
        include: { fromNote: { select: { id: true, title: true, slug: true } } },
      },
      linkedBy: {
        include: { toNote: { select: { id: true, title: true, slug: true } } },
      },
      attachments: true,
    },
  });

  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  return NextResponse.json(note);
}

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
    const data = updateNoteSchema.parse(body);

    const { tagIds, ...noteData } = data;
    await validateOwnedRelationships(session.user.id, {
      tagIds,
      noteParentId: noteData.parentId,
      selfId: id,
    });

    const updateData: any = { ...noteData };
    if (data.isPublished && !data.archived) {
      updateData.publishedAt = new Date();
    }

    // Update the note
    const note = await prisma.note.update({
      where: { id, userId: session.user.id },
      data: {
        ...updateData,
        ...(tagIds !== undefined
          ? { tags: { set: tagIds.map((tid: string) => ({ id: tid })) } }
          : {}),
      },
      include: { tags: true },
    });

    // Parse wikilinks and update backlinks
    if (data.content !== undefined) {
      const linkTitles = extractWikilinks(data.content);

      // Find notes that match the linked titles
      const linkedNotes = linkTitles.length > 0
        ? await prisma.note.findMany({
            where: {
              userId: session.user.id,
              OR: linkTitles.map((title) => ({
                OR: [{ title: title }, { slug: title }],
              })),
            },
            select: { id: true },
          })
        : [];

      const linkedNoteIds = linkedNotes.map((n) => n.id);

      // Delete existing backlinks from this note
      await prisma.noteBacklink.deleteMany({
        where: { fromNoteId: id },
      });

      // Create new backlinks
      if (linkedNoteIds.length > 0) {
        await prisma.noteBacklink.createMany({
          data: linkedNoteIds.map((toId) => ({
            fromNoteId: id,
            toNoteId: toId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    if (error instanceof InvalidRelationshipError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    console.error('Failed to update note:', error);
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
      where: { noteId: id, userId: session.user.id },
      select: { url: true, sizeBytes: true },
    });
    const stagedFiles = await stageFilesForDeletion(attachments.map(({ url }) => url));
    try {
      await prisma.note.delete({ where: { id, userId: session.user.id } });
    } catch (error) {
      await stagedFiles.rollback();
      throw error;
    }
    await stagedFiles.commit();
    await releaseUploadCapacity(
      session.user.id,
      attachments.reduce((total, attachment) => total + BigInt(attachment.sizeBytes), BigInt(0))
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    console.error('Failed to delete note:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
