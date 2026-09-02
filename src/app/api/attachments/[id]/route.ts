import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stageFilesForDeletion } from "@/lib/upload";
import { releaseUploadCapacity } from "@/lib/upload-quota";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    if (attachment.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stagedFiles = await stageFilesForDeletion([attachment.url]);
    try {
      await prisma.attachment.delete({ where: { id } });
    } catch (error) {
      await stagedFiles.rollback();
      throw error;
    }
    await stagedFiles.commit();
    await releaseUploadCapacity(session.user.id, attachment.sizeBytes);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete attachment error:", error);
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
