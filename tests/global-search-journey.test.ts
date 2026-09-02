import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");
const search = readFileSync("src/components/GlobalSearchResults.tsx", "utf8");

test("authenticated global search is wired to the tenant-scoped search endpoint", () => {
  assert.match(layout, /onSearch=\{setSearchQuery\}/);
  assert.match(layout, /searchQuery=\{searchQuery\}/);
  assert.match(layout, /<GlobalSearchResults query=\{searchQuery\}/);
  assert.match(search, /fetch\(`\/api\/search\?q=\$\{encodeURIComponent\(query\.trim\(\)\)\}`/);
  assert.match(search, /if \(!response\.ok\) throw new Error\("Search request failed"\)/);
});

test("global search exposes accessible loading, failure, empty, and navigable result states", () => {
  assert.match(search, /role="dialog"/);
  assert.match(search, /aria-modal="true"/);
  assert.match(search, /id="global-search-input"/);
  assert.match(search, /autoFocus/);
  assert.match(search, /onChange=\{\(event\) => onQueryChange\(event\.target\.value\)\}/);
  assert.match(search, /event\.key === "Escape"/);
  assert.match(search, /role="status"/);
  assert.match(search, /role="alert"/);
  assert.match(search, /No matching items/);
  assert.match(search, /href=\{group\.href\(item\)\}/);
});
