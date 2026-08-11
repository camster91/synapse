import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { path: pathSegments } = await params;
    const filename = pathSegments[pathSegments.length - 1];

    // Prevent directory traversal
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const attachment = await prisma.attachment.findFirst({
      where: { userId: session.user.id, url: `/uploads/${filename}` },
      select: { url: true, mimeType: true },
    });
    if (!attachment) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filePath = path.join(UPLOAD_DIR, filename);

    // Ensure the resolved path is still within UPLOAD_DIR
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const fileBuffer = await readFile(resolved);
    const ext = path.extname(filename).toLowerCase();
    const contentType = attachment.mimeType || MIME_MAP[ext] || "application/octet-stream";

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "private, max-age=3600");

    return new NextResponse(fileBuffer, { status: 200, headers });
  } catch (error) {
    console.error("File serve error:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}
