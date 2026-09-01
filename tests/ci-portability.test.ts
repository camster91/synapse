import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const lint = readFileSync(".github/workflows/lint.yml", "utf8");
const image = readFileSync(".github/workflows/build-and-push.yml", "utf8");
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

test("GitHub workflows use action runtimes supported by the hosted runner", () => {
  assert.doesNotMatch(`${ci}\n${lint}\n${image}`, /actions\/(checkout|setup-node)@v4/);
  assert.match(ci, /actions\/checkout@v5/);
  assert.match(ci, /actions\/setup-node@v5/);
  assert.match(lint, /actions\/checkout@v5/);
  assert.match(lint, /actions\/setup-node@v5/);
  assert.match(image, /actions\/checkout@v5/);
});

test("pull-request image checks cannot publish release artifacts", () => {
  assert.match(image, /if: github\.event_name != 'pull_request'\s+uses: docker\/login-action@v3/);
  assert.match(image, /push: \$\{\{ github\.event_name != 'pull_request' \}\}/);
  assert.match(image, /provenance: \$\{\{ github\.event_name != 'pull_request' \}\}/);
  assert.match(image, /sbom: \$\{\{ github\.event_name != 'pull_request' \}\}/);
  assert.match(image, /Image validated without publication/);
  assert.doesNotMatch(image, /push: true/);
});
