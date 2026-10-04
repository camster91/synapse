import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const image = readFileSync(".github/workflows/build-and-push.yml", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");

test("test discovery is portable across the local and GitHub shells", () => {
  assert.equal(packageJson.scripts.test, "tsx --test tests/*.test.ts");
  assert.doesNotMatch(packageJson.scripts.test, /\*\*/);
});

test("CI and production use a Node release supported by every dependency", () => {
  assert.equal(packageJson.engines.node, ">=22");
  assert.match(ci, /node-version: '24'/);
  assert.match(ci, /run: npm run lint/);
  assert.match(dockerfile, /FROM node:24-alpine/);
});

test("GitHub workflows use action runtimes supported by the hosted runner", () => {
  assert.doesNotMatch(`${ci}\n${image}`, /actions\/(checkout|setup-node)@v4/);
  assert.match(ci, /actions\/checkout@v5/);
  assert.match(ci, /actions\/setup-node@v5/);
  assert.match(image, /actions\/checkout@v5/);
});

test("pull-request image checks cannot publish release artifacts", () => {
  const [validationJob, publicationJob] = image.split("\n  publish:");

  assert.match(validationJob, /if: github\.event_name == 'pull_request'/);
  assert.match(validationJob, /permissions:\s+contents: read/);
  assert.match(validationJob, /push: false/);
  assert.match(validationJob, /provenance: false/);
  assert.match(validationJob, /sbom: false/);
  assert.doesNotMatch(validationJob, /packages: write|docker\/login-action|push: true/);

  assert.match(publicationJob, /if: github\.event_name != 'pull_request'/);
  assert.match(publicationJob, /packages: write/);
  assert.match(publicationJob, /docker\/login-action@v3/);
  assert.match(publicationJob, /push: true/);
  assert.match(image, /concurrency:\s+group: build-\$\{\{ github\.ref \}\}\s+cancel-in-progress: true/);
  assert.equal((image.match(/cache-from: type=gha,scope=synapse-image/g) ?? []).length, 2);
  assert.equal((image.match(/cache-to: type=gha,mode=max,scope=synapse-image/g) ?? []).length, 2);
  assert.doesNotMatch(image, /\.buildx-cache|type=local/);
});
