import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stageFilesForDeletion } from "../src/lib/upload";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploads = path.join(root, "uploads");

async function fixture(name: string): Promise<string> {
  await mkdir(uploads, { recursive: true });
  await writeFile(path.join(uploads, name), "attachment lifecycle test");
  return `/uploads/${name}`;
}

test("staged attachment deletion rolls back when the database delete fails", async () => {
  const name = `rollback-${crypto.randomUUID()}.txt`;
  await fixture(name);

  try {
    const staged = await stageFilesForDeletion([`/uploads/${name}`]);
    assert.equal(existsSync(path.join(uploads, name)), false);

    await staged.rollback();
    assert.equal(existsSync(path.join(uploads, name)), true);
  } finally {
    await rm(path.join(uploads, name), { force: true });
  }
});

test("staged attachment deletion commits after the database delete", async () => {
  const name = `commit-${crypto.randomUUID()}.txt`;
  await fixture(name);

  const staged = await stageFilesForDeletion([`/uploads/${name}`]);
  await staged.commit();

  assert.equal(existsSync(path.join(uploads, name)), false);
});

test("all attachment parent deletions use recoverable file staging", () => {
  for (const route of [
    "src/app/api/todos/[id]/route.ts",
    "src/app/api/notes/[id]/route.ts",
    "src/app/api/calendar/[id]/route.ts",
    "src/app/api/inbox/[id]/route.ts",
  ]) {
    const source = readFileSync(path.join(root, route), "utf8");
    const stageIndex = source.lastIndexOf("await stageFilesForDeletion(");
    const deleteIndex = Math.max(
      source.lastIndexOf("prisma.todo.delete("),
      source.lastIndexOf("prisma.note.delete("),
      source.lastIndexOf("prisma.calendarEvent.delete("),
      source.lastIndexOf("prisma.inboxItem.delete(")
    );

    assert.ok(stageIndex >= 0, `${route} must stage attachment files`);
    assert.ok(stageIndex < deleteIndex, `${route} must stage before database deletion`);
    assert.match(source, /await stagedFiles\.rollback\(\)/);
    assert.match(source, /await stagedFiles\.commit\(\)/);
  }
});
