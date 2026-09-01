import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const customerFacingFiles = [
  "README.md",
  "public/manifest.json",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/register/page.tsx",
  "src/components/DashboardPage.tsx",
  "src/app/api/chat/route.ts",
];

test("customer-facing positioning consistently connects goals to today", () => {
  const surfaces = customerFacingFiles.map((path) => readFileSync(path, "utf8")).join("\n");

  assert.doesNotMatch(surfaces, /second brain/i);
  assert.match(surfaces, /private daily operating system/i);
  assert.match(surfaces, /connect(?:s|ing)? goals to today/i);
  assert.match(readFileSync("src/app/register/page.tsx", "utf8"), /Connect your goals to today/);
});
