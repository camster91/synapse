import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod/v4';
import { getDefaultModel, getProviderForUser } from '@/lib/ai/provider';

// ─── GET /api/chat/conversations — List conversations ────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversations = await prisma.aiConversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      model: true,
      provider: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(
    conversations.map((c) => ({
      id: c.id,
      title: c.title,
      model: c.model,
      provider: c.provider,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
    }))
  );
}

// ─── POST /api/chat/conversations — Create conversation ─────────────────────

const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
}).strict();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createConversationSchema.parse(body);
    const provider = await getProviderForUser(session.user.id);

    const conversation = await prisma.aiConversation.create({
      data: {
        userId: session.user.id,
        title: data.title ?? 'New conversation',
        provider: provider.name,
        model: getDefaultModel(provider.name),
      },
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Failed to create conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
