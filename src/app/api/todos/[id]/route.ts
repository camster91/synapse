import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addXp } from '@/lib/xp';
import { fireHookForUser } from '@/lib/plugins/executor';
import { InvalidRelationshipError, validateOwnedRelationships } from '@/lib/ownership';
import { stageFilesForDeletion } from '@/lib/upload';
import { isoDateOrDateTimeSchema, isoDateTimeSchema } from '@/lib/date-validation';
import { z } from 'zod/v4';

const updateTodoSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(['INBOX', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'SNOOZED']).optional(),
  priority: z.int().min(0).max(5).optional(),
  dueDate: isoDateOrDateTimeSchema.nullable().optional(),
  scheduledAt: isoDateTimeSchema.nullable().optional(),
  goalId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.int().optional(),
  tagIds: z.array(z.string()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const todo = await prisma.todo.findFirst({
    where: { id, userId: session.user.id },
    include: {
      tags: true,
      subtasks: { orderBy: { sortOrder: 'asc' } },
      parent: { select: { id: true, title: true } },
      goal: { select: { id: true, title: true } },
      attachments: true,
    },
  });

  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json(todo);
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
    const data = updateTodoSchema.parse(body);

    // Check if status is changing to DONE for XP
    const existing = await prisma.todo.findFirst({
      where: { id, userId: session.user.id },
      select: { status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    const { tagIds, ...todoData } = data;
    await validateOwnedRelationships(session.user.id, {
      tagIds,
      goalId: todoData.goalId,
      todoParentId: todoData.parentId,
      selfId: id,
    });
    const wasNotDone = existing.status !== 'DONE';
    const markingDone = data.status === 'DONE';

    const updateData: any = { ...todoData };
    if (todoData.dueDate !== undefined) {
      updateData.dueDate = todoData.dueDate ? new Date(todoData.dueDate) : null;
    }
    if (todoData.scheduledAt !== undefined) {
      updateData.scheduledAt = todoData.scheduledAt ? new Date(todoData.scheduledAt) : null;
    }
    if (markingDone) {
      updateData.completedAt = new Date();
    }

    const todo = await prisma.todo.update({
      where: { id, userId: session.user.id },
      data: {
        ...updateData,
        ...(tagIds !== undefined
          ? { tags: { set: tagIds.map((tid: string) => ({ id: tid })) } }
          : {}),
      },
      include: { tags: true, subtasks: true },
    });

    // Award XP when marking a todo as done
    if (wasNotDone && markingDone) {
      await addXp(session.user.id, 10, 'todo_completed', id);
    }

    // Fire plugin hook when todo is completed
    if (wasNotDone && markingDone) {
      try {
        await fireHookForUser(session.user.id, 'onTodoCompleted', todo);
      } catch (hookErr) {
        console.error('Plugin hook onTodoCompleted failed:', hookErr);
      }
    }

    return NextResponse.json(todo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    if (error instanceof InvalidRelationshipError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }
    console.error('Failed to update todo:', error);
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
      where: { todoId: id, userId: session.user.id },
      select: { url: true },
    });
    const stagedFiles = await stageFilesForDeletion(attachments.map(({ url }) => url));
    try {
      await prisma.todo.delete({ where: { id, userId: session.user.id } });
    } catch (error) {
      await stagedFiles.rollback();
      throw error;
    }
    await stagedFiles.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }
    console.error('Failed to delete todo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
