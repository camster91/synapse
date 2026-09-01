import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const errorState = readFileSync("src/components/ResourceLoadError.tsx", "utf8");

for (const resource of ["todos", "habits", "goals"] as const) {
  test(`${resource} load failures cannot masquerade as empty data`, () => {
    const page = readFileSync(`src/app/(app)/${resource}/page.tsx`, "utf8");
    const title = resource[0].toUpperCase() + resource.slice(1);
    assert.ok(page.includes(`if (!response.ok) throw new Error("${title} request failed")`));
    assert.match(page, /setLoadError\(true\)/);
    assert.match(page, new RegExp(`ResourceLoadError resource=\"${resource}\"`));
    assert.doesNotMatch(page, /\.catch\(\(\) => \{\}\)/);
  });
}

test("collection recovery explains data safety and provides an accessible retry", () => {
  assert.match(errorState, /role="alert"/);
  assert.match(errorState, /Your data has not been replaced or removed/);
  assert.match(errorState, /onClick=\{onRetry\}/);
  assert.match(errorState, /Try again/);
  assert.match(errorState, /min-h-11/);
});
