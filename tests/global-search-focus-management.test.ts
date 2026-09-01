import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/GlobalSearchResults.tsx", "utf8");

test("global search restores focus when its modal closes", () => {
  const header = readFileSync("src/components/Header.tsx", "utf8");
  assert.match(header, /id="global-search-trigger"/);
  assert.match(header, /aria-haspopup="dialog"/);
  assert.match(source, /document\.getElementById\("global-search-trigger"\)\?\.focus\(\)/);
});

test("global search traps forward and reverse tab navigation", () => {
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /event\.shiftKey && document\.activeElement === first/);
  assert.match(source, /!event\.shiftKey && document\.activeElement === last/);
  assert.match(source, /ref=\{dialogRef\}/);
});
