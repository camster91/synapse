import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stageFilesForDeletion } from "@/lib/upload";

const deletionSchema = z.object({
  confirmation: z.literal("DELETE"),
  password: z.string().max(128).optional(),
});

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = deletionSchema.parse(await request.json());
    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: "credentials" },
      select: { accessToken: true },
    });

    if (account?.accessToken) {
      const validPassword = data.password
        ? await bcrypt.compare(data.password, account.accessToken)
        : false;
      if (!validPassword) {
        return NextResponse.json({ error: "Password is incorrect" }, { status: 403 });
      }
    }

    const attachments = await prisma.attachment.findMany({
      where: { userId: session.user.id },
      select: { url: true },
    });
    const stagedFiles = await stageFilesForDeletion(attachments.map(({ url }) => url));

    try {
      // User-owned records are removed through schema cascade relationships.
      await prisma.user.delete({ where: { id: session.user.id } });
    } catch (error) {
      await stagedFiles.rollback();
      throw error;
    }

    await stagedFiles.commit();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
    }
    console.error("Failed to delete account:", error);
    return NextResponse.json({ error: "Account deletion failed" }, { status: 500 });
  }
}
