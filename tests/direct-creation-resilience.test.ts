import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const resources = ["todos", "habits", "goals", "notes", "calendar"] as const;

for (const resource of resources) {
  test(`${resource} creation preserves its draft and prevents duplicate submission`, () => {
    const page = readFileSync(`src/app/(app)/${resource}/page.tsx`, "utf8");
    assert.match(page, /const \[creating, setCreating\] = useState\(false\)/);
    assert.match(page, /const \[createError, setCreateError\] = useState<string \| null>\(null\)/);
    assert.match(page, /Your draft has been preserved\./);
    assert.match(page, /role="alert"/);
    assert.match(page, /disabled=\{![a-zA-Z]+\.(?:trim\(\)) \|\| creating\}/);
    assert.match(page, /if \(!res\.ok\) throw new Error\(/);
  });
}
