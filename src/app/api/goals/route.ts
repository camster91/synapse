import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod/v4';

const createGoalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ABANDONED', 'ON_HOLD']).default('ACTIVE'),
  level: z.enum(['YEARLY', 'QUARTERLY', 'MONTHLY', 'WEEKLY']).default('QUARTERLY'),
  parentId: z.string().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  progress: z.int().min(0).max(100).default(0),
  tagIds: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level');
  const status = searchParams.get('status');

  const where: any = { userId: session.user.id };
  if (level) where.level = level;
  if (status) where.status = status;

  const goals = await prisma.goal.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    include: {
      tags: { select: { id: true, name: true, color: true } },
      children: { orderBy: { createdAt: 'asc' } },
      _count: { select: { todos: true } },
    },
  });

  return NextResponse.json(goals);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createGoalSchema.parse(body);

    const { tagIds, ...goalData } = data;

    const goal = await prisma.goal.create({
      data: {
        ...goalData,
        startDate: goalData.startDate ? new Date(goalData.startDate) : undefined,
        endDate: goalData.endDate ? new Date(goalData.endDate) : undefined,
        userId: session.user.id,
        ...(tagIds && tagIds.length > 0
          ? { tags: { connect: tagIds.map((id: string) => ({ id })) } }
          : {}),
      },
      include: { tags: true, children: true },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('Failed to create goal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}