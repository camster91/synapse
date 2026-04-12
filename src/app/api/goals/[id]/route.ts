import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod/v4';

const updateGoalSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ABANDONED', 'ON_HOLD']).optional(),
  level: z.enum(['YEARLY', 'QUARTERLY', 'MONTHLY', 'WEEKLY']).optional(),
  parentId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  progress: z.int().min(0).max(100).optional(),
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

  const goal = await prisma.goal.findFirst({
    where: { id, userId: session.user.id },
    include: {
      tags: true,
      children: { orderBy: { createdAt: 'asc' } },
      parent: { select: { id: true, title: true } },
      todos: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!goal) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  }

  return NextResponse.json(goal);
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
    const data = updateGoalSchema.parse(body);

    const { tagIds, ...goalData } = data;

    const updateData: any = { ...goalData };
    if (goalData.startDate !== undefined) {
      updateData.startDate = goalData.startDate ? new Date(goalData.startDate) : null;
    }
    if (goalData.endDate !== undefined) {
      updateData.endDate = goalData.endDate ? new Date(goalData.endDate) : null;
    }

    // Auto-set status to COMPLETED when progress hits 100
    if (goalData.progress === 100 && !goalData.status) {
      updateData.status = 'COMPLETED';
    }

    const goal = await prisma.goal.update({
      where: { id, userId: session.user.id },
      data: {
        ...updateData,
        ...(tagIds !== undefined
          ? { tags: { set: tagIds.map((tid: string) => ({ id: tid })) } }
          : {}),
      },
      include: { tags: true, children: true },
    });

    return NextResponse.json(goal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }
    console.error('Failed to update goal:', error);
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
    await prisma.goal.delete({ where: { id, userId: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }
    console.error('Failed to delete goal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}