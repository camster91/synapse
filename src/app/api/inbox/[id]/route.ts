import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod/v4';
import { stageFilesForDeletion } from '@/lib/upload';

const updateInboxSchema = z.object({
  processed: z.boolean().optional(),
  linkedId: z.string().optional(),
  content: z.string().min(1).max(10000).optional(),
  type: z.enum(['THOUGHT', 'LINK', 'IMAGE', 'TASK', 'NOTE']).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params });
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
    const data = updateInboxSchema.parse(body);

    // If marking as processed, also set processedAt and linkedId
    const updateData: any = { ...data };
    if (data.processed === true) {
      updateData.processedAt = new Date();
    }
    if (data.linkedId) {
      updateData.processed = true;
      updateData.processedAt = new Date();
    }

    const item = await prisma.inboxItem.update({
      where: { id, userId: session.user.id },
      data: updateData,
    });

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Inbox item not found' }, { status: 404 });
    }
    console.error('Failed to update inbox item:', error);
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
      where: { inboxItemId: id, userId: session.user.id },
      select: { url: true },
    });
    const stagedFiles = await stageFilesForDeletion(attachments.map(({ url }) => url));
    try {
      await prisma.inboxItem.delete({ where: { id, userId: session.user.id } });
    } catch (error) {
      await stagedFiles.rollback();
      throw error;
    }
    await stagedFiles.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Inbox item not found' }, { status: 404 });
    }
    console.error('Failed to delete inbox item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
