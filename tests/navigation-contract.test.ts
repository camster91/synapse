import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("the Today navigation target is the authenticated dashboard route", () => {
  const sidebar = readFileSync(join(process.cwd(), "src/components/Sidebar.tsx"), "utf8");

  assert.match(sidebar, /\{ href: "\/today", icon: LayoutDashboard, label: "Today" \}/);
});

test("the service worker does not cache auth pages or navigations indefinitely", () => {
  const worker = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

  assert.match(worker, /const CACHE_NAME = "synapse-v3"/);
  assert.doesNotMatch(worker, /PRECACHE_URLS = \["\/", "\/login"/);
  assert.match(worker, /request\.mode === "navigate"/);
});
