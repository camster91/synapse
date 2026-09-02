import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

test("mobile navigation backdrop is keyboard-operable", () => {
  const layout = read("src/app/(app)/layout.tsx");
  assert.match(layout, /<button[\s\S]*?aria-label="Close navigation menu"[\s\S]*?setSidebarOpen\(false\)/);
  assert.doesNotMatch(
    layout,
    /<div\s+className="fixed inset-0 bg-black\/50 z-30 lg:hidden"/
  );
});

test("calendar controls and day cells have semantic buttons and names", () => {
  const calendar = read("src/app/(app)/calendar/page.tsx");
  assert.match(calendar, /aria-label="Previous month"/);
  assert.match(calendar, /aria-label="Next month"/);
  assert.match(calendar, /aria-label=\{`\$\{new Date\(year, month, day\)\.toLocaleDateString\(\)\}/);
  assert.doesNotMatch(calendar, /<div[\s\S]{0,300}?dayEvents\.length > 0[\s\S]{0,100}?setShowEvent/);
});
