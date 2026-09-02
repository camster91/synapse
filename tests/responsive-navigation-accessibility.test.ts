import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const header = readFileSync("src/components/Header.tsx", "utf8");
const sidebar = readFileSync("src/components/Sidebar.tsx", "utf8");

test("mobile search uses the real global-search journey instead of a native prompt", () => {
  assert.doesNotMatch(header, /prompt\("Search:"\)/);
  assert.match(header, /setMobileSearchOpen\(true\)/);
  assert.match(header, /autoFocus=\{mobileSearchOpen\}/);
  assert.match(header, /aria-label="Close search field"/);
  assert.match(header, /onSearch\?\.\(""\)/);
});

test("sidebar icon-only controls expose their action and state", () => {
  assert.match(sidebar, /aria-label="Close navigation menu"/);
  assert.match(sidebar, /aria-label=\{collapsed \? "Expand navigation" : "Collapse navigation"\}/);
  assert.match(sidebar, /aria-expanded=\{!collapsed\}/);
});
