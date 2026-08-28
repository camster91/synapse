import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const mutationRoutes = [
  "src/app/api/todos/route.ts",
  "src/app/api/todos/[id]/route.ts",
  "src/app/api/notes/route.ts",
  "src/app/api/notes/[id]/route.ts",
  "src/app/api/goals/route.ts",
  "src/app/api/goals/[id]/route.ts",
  "src/app/api/calendar/route.ts",
  "src/app/api/calendar/[id]/route.ts",
  "src/app/api/journal/route.ts",
];

test("all relationship mutation routes validate ownership before writing", () => {
  for (const route of mutationRoutes) {
    const source = read(route);
    const validationIndex = source.indexOf("await validateOwnedRelationships(");
    const writeIndexes = [
      source.indexOf("prisma.todo.create("),
      source.indexOf("prisma.todo.update("),
      source.indexOf("prisma.note.create("),
      source.indexOf("prisma.note.update("),
      source.indexOf("prisma.goal.create("),
      source.indexOf("prisma.goal.update("),
      source.indexOf("prisma.calendarEvent.create("),
      source.indexOf("prisma.calendarEvent.update("),
      source.indexOf("prisma.journal.upsert("),
    ].filter((index) => index >= 0);

    assert.ok(validationIndex >= 0, `${route} must validate relationships`);
    assert.ok(writeIndexes.length > 0, `${route} must contain a mutation`);
    assert.ok(
      writeIndexes.every((writeIndex) => validationIndex < writeIndex),
      `${route} must validate before writing`
    );
    assert.match(source, /error instanceof InvalidRelationshipError/);
  }
});

test("relationship lookups are scoped to the authenticated user", () => {
  const source = read("src/lib/ownership.ts");

  assert.match(source, /prisma\.tag\.count\([\s\S]*?userId/);
  assert.match(source, /prisma\.goal\.findFirst\([\s\S]*?where: \{ id: goalId, userId \}/);
  assert.match(source, /prisma\.todo\.findFirst\([\s\S]*?where: \{ id: currentId, userId \}/);
  assert.match(source, /prisma\.note\.findFirst\([\s\S]*?where: \{ id: currentId, userId \}/);
  assert.match(source, /prisma\.goal\.findFirst\([\s\S]*?where: \{ id: currentId, userId \}/);
  assert.match(source, /ownedCount !== uniqueIds\.length/);
});

test("hierarchical relationships reject self-reference and ancestor cycles", () => {
  const source = read("src/lib/ownership.ts");

  assert.equal((source.match(/currentId === selfId/g) ?? []).length, 3);
  assert.equal((source.match(/visited\.has\(currentId\)/g) ?? []).length, 3);
  assert.match(source, /Todo parent would create a cycle/);
  assert.match(source, /Note parent would create a cycle/);
  assert.match(source, /Goal parent would create a cycle/);
});

test("todo relations include both goal and parent ownership checks", () => {
  for (const route of [
    "src/app/api/todos/route.ts",
    "src/app/api/todos/[id]/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /goalId: todoData\.goalId/);
    assert.match(source, /todoParentId: todoData\.parentId/);
  }
});
