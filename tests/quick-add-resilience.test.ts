import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const quickAdd = readFileSync("src/components/QuickAdd.tsx", "utf8");
const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");

test("quick add awaits creation and preserves input when creation fails", () => {
  assert.match(quickAdd, /await onAddTodo\?\.\(inputValue\.trim\(\)\)/);
  assert.match(quickAdd, /await onAddNote\?\.\(inputValue\.trim\(\)\)/);
  assert.match(quickAdd, /await onAddInbox\?\.\(inputValue\.trim\(\)\)/);
  assert.match(quickAdd, /Your text has been preserved\./);
  assert.match(quickAdd, /role="alert"/);
  assert.match(quickAdd, /disabled=\{!inputValue\.trim\(\) \|\| submitting\}/);
});

test("global quick add handlers reject unsuccessful API responses", () => {
  assert.match(layout, /if \(!response\.ok\) throw new Error\("Todo creation failed"\)/);
  assert.match(layout, /if \(!response\.ok\) throw new Error\("Note creation failed"\)/);
  assert.match(layout, /if \(!response\.ok\) throw new Error\("Inbox creation failed"\)/);
});
