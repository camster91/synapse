import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("production build does not fetch Google Fonts", () => {
  const layout = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.doesNotMatch(layout, /fonts\.googleapis\.com/);
});

test("public landing and authenticated dashboard do not claim the same route", () => {
  assert.equal(existsSync(path.join(root, "src/app/page.tsx")), true);
  assert.equal(existsSync(path.join(root, "src/app/(app)/page.tsx")), false);

  const today = readFileSync(path.join(root, "src/app/(app)/today/page.tsx"), "utf8");
  assert.match(today, /@\/components\/DashboardPage/);
});
