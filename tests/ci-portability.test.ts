import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const lint = readFileSync(".github/workflows/lint.yml", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");

test("test discovery is portable across the local and GitHub shells", () => {
  assert.equal(packageJson.scripts.test, "tsx --test tests/*.test.ts");
  assert.doesNotMatch(packageJson.scripts.test, /\*\*/);
});

test("CI and production use a Node release supported by every dependency", () => {
  assert.equal(packageJson.engines.node, ">=22");
  assert.match(ci, /node-version: '24'/);
  assert.match(lint, /node-version: '24'/);
  assert.match(dockerfile, /FROM node:24-alpine/);
});
