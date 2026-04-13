import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod/v4';

const createHabitSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'CUSTOM']).default('DAILY'),
  targetCount: z.int().min(1).default(1),
  schedule: z.any().optional(),
  sortOrder: z.int().default(0),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const habits = await prisma.habit.findMany({
    where: { userId: session.user.id, archived: false },
    orderBy: { sortOrder: 'asc' },
    include: { logs: { orderBy: { date: 'desc' }, take: 30 } },
  });

  return NextResponse.json(habits);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createHabitSchema.parse(body);

    const habit = await prisma.habit.create({
      data: {
        ...data,
        userId: session.user.id,
      },
      include: { logs: true },
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('Failed to create habit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}