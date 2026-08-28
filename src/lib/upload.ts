import { writeFile, mkdir, unlink, rename } from "fs/promises";
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

export type StagedFileDeletion = {
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
};

/**
 * Move files out of the served uploads directory before a related database
 * delete. Roll the moves back if the database operation fails; after a
 * successful commit, files are removed from the private trash directory.
 */
export async function stageFilesForDeletion(
  urls: string[]
): Promise<StagedFileDeletion> {
  const trashDir = path.join(UPLOAD_DIR, ".trash");
  await mkdir(trashDir, { recursive: true });

  const staged: { source: string; trash: string }[] = [];

  try {
    for (const url of [...new Set(urls)]) {
      const filename = url.split("/").pop();
      if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        continue;
      }

      const source = path.resolve(UPLOAD_DIR, filename);
      if (path.dirname(source) !== path.resolve(UPLOAD_DIR) || !existsSync(source)) continue;

      const trash = path.join(trashDir, `${crypto.randomUUID()}-${filename}`);
      await rename(source, trash);
      staged.push({ source, trash });
    }
  } catch (error) {
    await Promise.allSettled(
      staged.reverse().map(({ source, trash }) => rename(trash, source))
    );
    throw error;
  }

  return {
    async commit() {
      const results = await Promise.allSettled(
        staged.map(({ trash }) => unlink(trash))
      );
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("Failed to remove staged upload:", result.reason);
        }
      }
    },
    async rollback() {
      const results = await Promise.allSettled(
        staged.reverse().map(({ source, trash }) => rename(trash, source))
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    },
  };
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
