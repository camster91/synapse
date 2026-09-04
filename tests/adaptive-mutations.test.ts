import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdaptiveMutations,
  buildUndoState,
  canSafelyUndoMutation,
  type AdaptiveTodoState,
} from "../src/lib/adaptive-mutations";

function todo(overrides: Partial<AdaptiveTodoState> = {}): AdaptiveTodoState {
  return {
    id: "todo-1",
    status: "TODO",
    priority: 4,
    dueDate: "2026-09-05T16:00:00.000Z",
    scheduledAt: "2026-09-03T21:00:00.000Z",
    deferredUntil: null,
    estimatedMinutes: 60,
    minimumMinutes: 20,
    updatedAt: "2026-09-03T20:00:00.000Z",
    ...overrides,
  };
}

test("drop defers Today without clearing deadline or schedule", () => {
  const [mutation] = buildAdaptiveMutations([todo()], [{ itemId: "todo-1", action: "drop", targetDeferredUntil: "2026-09-04T04:00:00.000Z" }]);
  assert.equal(mutation.after.deferredUntil, "2026-09-04T04:00:00.000Z");
  assert.equal(mutation.after.dueDate, mutation.before.dueDate);
  assert.equal(mutation.after.scheduledAt, mutation.before.scheduledAt);
});

test("move changes schedule but preserves deadline", () => {
  const [mutation] = buildAdaptiveMutations([todo()], [{ itemId: "todo-1", action: "move", targetScheduledAt: "2026-09-04T13:00:00.000Z" }]);
  assert.equal(mutation.after.scheduledAt, "2026-09-04T13:00:00.000Z");
  assert.equal(mutation.after.dueDate, mutation.before.dueDate);
});

test("shorten requires explicit minimum effort and remains within bounds", () => {
  const [mutation] = buildAdaptiveMutations([todo()], [{ itemId: "todo-1", action: "shorten", targetEstimatedMinutes: 30 }]);
  assert.equal(mutation.after.estimatedMinutes, 30);
  assert.throws(() => buildAdaptiveMutations([todo({ minimumMinutes: null })], [{ itemId: "todo-1", action: "shorten", targetEstimatedMinutes: 30 }]));
  assert.throws(() => buildAdaptiveMutations([todo()], [{ itemId: "todo-1", action: "shorten", targetEstimatedMinutes: 10 }]));
});

test("duplicate recommendations fail before mutation planning", () => {
  assert.throws(() => buildAdaptiveMutations([todo()], [
    { itemId: "todo-1", action: "drop", targetDeferredUntil: "2026-09-04T04:00:00.000Z" },
    { itemId: "todo-1", action: "move", targetScheduledAt: "2026-09-04T13:00:00.000Z" },
  ]));
});

test("undo restores only when adaptive after-state is still current", () => {
  const [mutation] = buildAdaptiveMutations([todo()], [{ itemId: "todo-1", action: "move", targetScheduledAt: "2026-09-04T13:00:00.000Z" }]);
  const current = { ...mutation.after, updatedAt: "2026-09-03T20:05:00.000Z" };
  assert.equal(canSafelyUndoMutation(mutation, current), true);
  assert.equal(buildUndoState(mutation, current).scheduledAt, mutation.before.scheduledAt);

  const editedAgain = { ...current, scheduledAt: "2026-09-04T15:00:00.000Z" };
  assert.equal(canSafelyUndoMutation(mutation, editedAgain), false);
  assert.throws(() => buildUndoState(mutation, editedAgain));
});
