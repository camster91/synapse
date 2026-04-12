import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod/v4';

const createInboxSchema = z.object({
  content: z.string().min(1).max(10000),
  source: z.enum(['MANUAL', 'AI_CHAT', 'EMAIL', 'WEB_CLIPPER', 'PLUGIN']).default('MANUAL'),
  type: z.enum(['THOUGHT', 'LINK', 'IMAGE', 'TASK', 'NOTE']).default('THOUGHT'),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const items = await prisma.inboxItem.findMany({
    where: { userId: session.user.id, processed: false },
    orderBy: { createdAt: 'desc' },
    include: { attachments: true },
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createInboxSchema.parse(body);

    const item = await prisma.inboxItem.create({
      data: {
        ...data,
        userId: session.user.id,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('Failed to create inbox item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}