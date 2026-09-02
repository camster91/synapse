import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFile, saveFile } from "@/lib/upload";
import { releaseUploadCapacity, reserveUploadCapacity } from "@/lib/upload-quota";

const VALID_ENTITY_TYPES = [
  "note",
  "todo",
  "calendarEvent",
  "inboxItem",
] as const;

type EntityType = (typeof VALID_ENTITY_TYPES)[number];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string | null;
    const entityId = formData.get("entityId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!entityType || !VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
      return NextResponse.json(
        { error: "Invalid entityType. Must be one of: note, todo, calendarEvent, inboxItem" },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        { error: "entityId is required" },
        { status: 400 }
      );
    }

    // Verify the entity exists and belongs to the user
    const entityCheck = await verifyEntityOwnership(
      session.user.id,
      entityType as EntityType,
      entityId
    );
    if (!entityCheck) {
      return NextResponse.json(
        { error: "Entity not found or access denied" },
        { status: 404 }
      );
    }

    const reserved = await reserveUploadCapacity(session.user.id, file.size);
    if (!reserved) {
      return NextResponse.json(
        { error: "Upload storage limit reached (512 MB per account)" },
        { status: 413 }
      );
    }

    let saved: Awaited<ReturnType<typeof saveFile>> | null = null;
    try {
      saved = await saveFile(file);
      const attachment = await prisma.attachment.create({
        data: {
          userId: session.user.id,
          url: saved.url,
          filename: saved.filename,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          noteId: entityType === "note" ? entityId : null,
          todoId: entityType === "todo" ? entityId : null,
          calendarEventId: entityType === "calendarEvent" ? entityId : null,
          inboxItemId: entityType === "inboxItem" ? entityId : null,
        },
      });

      return NextResponse.json(attachment, { status: 201 });
    } catch (error) {
      await Promise.allSettled([
        releaseUploadCapacity(session.user.id, file.size),
        ...(saved ? [deleteFile(saved.url)] : []),
      ]);
      throw error;
    }
  } catch (error: any) {
    console.error("Upload error:", error);
    const message = error?.message || "Upload failed";
    const status = message.includes("too large")
      ? 413
      : message.includes("not allowed")
        ? 415
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function verifyEntityOwnership(
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  switch (entityType) {
    case "note": {
      const note = await prisma.note.findFirst({
        where: { id: entityId, userId },
        select: { id: true },
      });
      return !!note;
    }
    case "todo": {
      const todo = await prisma.todo.findFirst({
        where: { id: entityId, userId },
        select: { id: true },
      });
      return !!todo;
    }
    case "calendarEvent": {
      const event = await prisma.calendarEvent.findFirst({
        where: { id: entityId, userId },
        select: { id: true },
      });
      return !!event;
    }
    case "inboxItem": {
      const item = await prisma.inboxItem.findFirst({
        where: { id: entityId, userId },
        select: { id: true },
      });
      return !!item;
    }
    default:
      return false;
  }
}
