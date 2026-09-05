import { mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const RESTORE_UPLOAD_OVERRIDE_CONFIRM = "restore-drill-disposable-upload-target";

function resolveUploadDir() {
  const configured = process.argv[2];
  if (!configured) return path.join(process.cwd(), "uploads");

  if (process.env.SYNAPSE_UPLOAD_DIR_CONFIRM !== RESTORE_UPLOAD_OVERRIDE_CONFIRM) {
    throw new Error(
      `explicit upload target requires SYNAPSE_UPLOAD_DIR_CONFIRM=${RESTORE_UPLOAD_OVERRIDE_CONFIRM}`
    );
  }
  if (!path.isAbsolute(configured)) {
    throw new Error("explicit upload target must be an absolute path");
  }

  const resolved = path.resolve(configured);
  const root = path.parse(resolved).root;
  if (resolved === root || resolved === homedir() || resolved === process.cwd()) {
    throw new Error("Refusing unsafe explicit upload target");
  }

  return resolved;
}

async function main() {
  const explicitRestoreTarget = Boolean(process.argv[2]);
  const uploadDir = resolveUploadDir();
  const trashDir = path.join(uploadDir, ".trash");
  await mkdir(uploadDir, { recursive: true });

  // Query the authoritative database before removing anything. If the database
  // is unavailable, startup fails closed and the upload volume is untouched.
  const attachments = await prisma.attachment.findMany({
    select: { url: true },
  });
  const referenced = new Set(
    attachments
      .map(({ url }) => url.split("/").pop())
      .filter((filename): filename is string => Boolean(filename))
  );

  const uploadEntries = await readdir(uploadDir, { withFileTypes: true });
  const regularFiles = new Set(
    uploadEntries.filter((entry) => entry.isFile()).map((entry) => entry.name)
  );

  // The explicit target is available only to the disposable restore drill. In
  // that mode, reconciliation must prove completeness as well as remove stale
  // files: every attachment row restored from PostgreSQL must have its matching
  // regular file before any orphan cleanup can make the result look healthy.
  if (explicitRestoreTarget) {
    const missingReferenced = [...referenced].filter(
      (filename) => !regularFiles.has(filename)
    );
    if (missingReferenced.length > 0) {
      throw new Error(
        `restore upload target is missing ${missingReferenced.length} referenced attachment file(s)`
      );
    }
  }

  let removedOrphans = 0;
  for (const entry of uploadEntries) {
    if (!entry.isFile() || referenced.has(entry.name)) continue;
    await rm(path.join(uploadDir, entry.name), { force: true });
    removedOrphans++;
  }

  // At process startup there are no in-flight staged deletions, so every trash
  // entry is a residue from a previously committed or interrupted operation.
  let removedTrashEntries = 0;
  try {
    const trashEntries = await readdir(trashDir, { withFileTypes: true });
    for (const entry of trashEntries) {
      await rm(path.join(trashDir, entry.name), { recursive: true, force: true });
      removedTrashEntries++;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  // Rebuild accounting from authoritative attachment rows to repair any prior
  // interrupted quota release.
  await prisma.$executeRaw`
    UPDATE "users" AS u
    SET "uploadBytes" = COALESCE(attachment_totals.total, 0)
    FROM (
      SELECT users.id AS "userId", COALESCE(SUM(attachments."sizeBytes"), 0)::BIGINT AS total
      FROM "users" AS users
      LEFT JOIN "attachments" AS attachments ON attachments."userId" = users.id
      GROUP BY users.id
    ) AS attachment_totals
    WHERE u.id = attachment_totals."userId"
  `;

  console.log(
    `[uploads] reconciled ${attachments.length} attachment(s); removed ${removedOrphans} orphan(s) and ${removedTrashEntries} staged residue(s)`
  );
}

main()
  .catch((error) => {
    console.error("[uploads] reconciliation failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
