import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
];

const BLOCKED_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".msi",
  ".com",
  ".scr",
  ".vbs",
  ".js",
  ".mjs",
  ".cjs",
];

export async function saveFile(file: File): Promise<{
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}> {
  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large (max 10MB)");
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      "File type not allowed. Allowed: images, PDF, TXT, MD, JSON"
    );
  }

  // Block executable extensions
  const ext = path.extname(file.name).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    throw new Error("Executable files are not allowed");
  }

  // Ensure uploads dir exists
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  // Generate unique filename
  const fileExt = ext || mimeToExt(file.type);
  const uniqueName = `${crypto.randomUUID()}${fileExt}`;
  const filePath = path.join(UPLOAD_DIR, uniqueName);

  // Write file
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return {
    url: `/uploads/${uniqueName}`,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export async function deleteFile(url: string): Promise<void> {
  const filename = url.split("/").pop();
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) return;
  const filePath = path.resolve(UPLOAD_DIR, filename);
  // Ensure resolved path stays within UPLOAD_DIR
  if (!filePath.startsWith(path.resolve(UPLOAD_DIR))) return;
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "application/json": ".json",
  };
  return map[mime] || ".bin";
}