import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod/v4';

const updatePluginSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.any().optional(),
});

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
    const data = updatePluginSchema.parse(body);

    const userPlugin = await prisma.userPlugin.update({
      where: { id, userId: session.user.id },
      data,
      include: { plugin: true },
    });

    return NextResponse.json(userPlugin);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Plugin installation not found' }, { status: 404 });
    }
    console.error('Failed to update plugin:', error);
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
    await prisma.userPlugin.delete({ where: { id, userId: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Plugin installation not found' }, { status: 404 });
    }
    console.error('Failed to uninstall plugin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}