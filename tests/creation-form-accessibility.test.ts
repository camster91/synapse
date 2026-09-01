import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("primary creation forms programmatically associate visible labels", () => {
  const controlsByFile: Record<string, string[]> = {
    "src/app/(app)/todos/page.tsx": [
      "new-todo-title",
      "new-todo-description",
      "new-todo-priority",
      "new-todo-status",
    ],
    "src/app/(app)/habits/page.tsx": ["new-habit-name", "new-habit-description"],
    "src/app/(app)/goals/page.tsx": ["new-goal-title"],
    "src/app/(app)/notes/page.tsx": ["new-note-title"],
    "src/app/(app)/calendar/page.tsx": [
      "new-event-title",
      "new-event-start",
      "new-event-end",
      "new-event-location",
    ],
  };

  for (const [path, controlIds] of Object.entries(controlsByFile)) {
    const source = read(path);
    for (const id of controlIds) {
      assert.match(source, new RegExp(`htmlFor=["']${id}["']`), `${path} labels ${id}`);
      assert.match(source, new RegExp(`id=["']${id}["']`), `${path} exposes ${id}`);
    }
  }
});

test("habit frequency and goal timeframe expose grouped selected states", () => {
  const habits = read("src/app/(app)/habits/page.tsx");
  const goals = read("src/app/(app)/goals/page.tsx");

  assert.match(habits, /<fieldset>[\s\S]*?<legend[^>]*>Frequency<\/legend>[\s\S]*?aria-pressed=\{newFrequency === f\}[\s\S]*?<\/fieldset>/);
  assert.match(goals, /<fieldset>[\s\S]*?<legend[^>]*>Timeframe<\/legend>[\s\S]*?aria-pressed=\{newLevel === level\}[\s\S]*?<\/fieldset>/);
});
