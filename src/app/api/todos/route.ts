import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InvalidRelationshipError, validateOwnedRelationships } from '@/lib/ownership';
import { isoDateOrDateTimeSchema, isoDateTimeSchema } from '@/lib/date-validation';
import { z } from 'zod/v4';

const createTodoSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  status: z.enum(['INBOX', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'SNOOZED']).default('INBOX'),
  priority: z.int().min(0).max(5).default(0),
  dueDate: isoDateOrDateTimeSchema.optional(),
  scheduledAt: isoDateTimeSchema.optional(),
  goalId: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.int().default(0),
  tagIds: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const goalId = searchParams.get('goalId');

  const where: any = { userId: session.user.id };
  if (status) where.status = status;
  if (priority) where.priority = parseInt(priority, 10);
  if (goalId) where.goalId = goalId;

  const todos = await prisma.todo.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: {
      tags: true,
      subtasks: { orderBy: { sortOrder: 'asc' } },
      goal: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(todos);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createTodoSchema.parse(body);

    const { tagIds, ...todoData } = data;

    await validateOwnedRelationships(session.user.id, {
      tagIds,
      goalId: todoData.goalId,
      todoParentId: todoData.parentId,
    });

    const todo = await prisma.todo.create({
      data: {
        ...todoData,
        dueDate: todoData.dueDate ? new Date(todoData.dueDate) : undefined,
        scheduledAt: todoData.scheduledAt ? new Date(todoData.scheduledAt) : undefined,
        userId: session.user.id,
        ...(tagIds && tagIds.length > 0
          ? { tags: { connect: tagIds.map((id: string) => ({ id })) } }
          : {}),
      },
      include: { tags: true, subtasks: true },
    });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    if (error instanceof InvalidRelationshipError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create todo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
