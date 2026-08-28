import { prisma } from "@/lib/prisma";

export class InvalidRelationshipError extends Error {
  constructor(message = "One or more related records are invalid") {
    super(message);
    this.name = "InvalidRelationshipError";
  }
}

type RelationshipInput = {
  tagIds?: string[];
  goalId?: string | null;
  todoParentId?: string | null;
  noteParentId?: string | null;
  goalParentId?: string | null;
  selfId?: string;
};

async function validateTags(userId: string, tagIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(tagIds)];
  const ownedCount = await prisma.tag.count({
    where: { id: { in: uniqueIds }, userId },
  });

  if (ownedCount !== uniqueIds.length) {
    throw new InvalidRelationshipError("One or more tags are invalid");
  }
}

async function validateGoal(userId: string, goalId: string): Promise<void> {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
    select: { id: true },
  });
  if (!goal) throw new InvalidRelationshipError("Goal is invalid");
}

async function validateTodoParent(
  userId: string,
  parentId: string,
  selfId?: string
): Promise<void> {
  const visited = new Set<string>();
  let currentId: string | null = parentId;

  while (currentId) {
    if (currentId === selfId || visited.has(currentId)) {
      throw new InvalidRelationshipError("Todo parent would create a cycle");
    }
    visited.add(currentId);

    const parent: { parentId: string | null } | null = await prisma.todo.findFirst({
      where: { id: currentId, userId },
      select: { parentId: true },
    });
    if (!parent) throw new InvalidRelationshipError("Todo parent is invalid");
    currentId = parent.parentId;
  }
}

async function validateNoteParent(
  userId: string,
  parentId: string,
  selfId?: string
): Promise<void> {
  const visited = new Set<string>();
  let currentId: string | null = parentId;

  while (currentId) {
    if (currentId === selfId || visited.has(currentId)) {
      throw new InvalidRelationshipError("Note parent would create a cycle");
    }
    visited.add(currentId);

    const parent: { parentId: string | null } | null = await prisma.note.findFirst({
      where: { id: currentId, userId },
      select: { parentId: true },
    });
    if (!parent) throw new InvalidRelationshipError("Note parent is invalid");
    currentId = parent.parentId;
  }
}

async function validateGoalParent(
  userId: string,
  parentId: string,
  selfId?: string
): Promise<void> {
  const visited = new Set<string>();
  let currentId: string | null = parentId;

  while (currentId) {
    if (currentId === selfId || visited.has(currentId)) {
      throw new InvalidRelationshipError("Goal parent would create a cycle");
    }
    visited.add(currentId);

    const parent: { parentId: string | null } | null = await prisma.goal.findFirst({
      where: { id: currentId, userId },
      select: { parentId: true },
    });
    if (!parent) throw new InvalidRelationshipError("Goal parent is invalid");
    currentId = parent.parentId;
  }
}

export async function validateOwnedRelationships(
  userId: string,
  input: RelationshipInput
): Promise<void> {
  const checks: Promise<void>[] = [];

  if (input.tagIds !== undefined) checks.push(validateTags(userId, input.tagIds));
  if (input.goalId) checks.push(validateGoal(userId, input.goalId));
  if (input.todoParentId) {
    checks.push(validateTodoParent(userId, input.todoParentId, input.selfId));
  }
  if (input.noteParentId) {
    checks.push(validateNoteParent(userId, input.noteParentId, input.selfId));
  }
  if (input.goalParentId) {
    checks.push(validateGoalParent(userId, input.goalParentId, input.selfId));
  }

  await Promise.all(checks);
}
