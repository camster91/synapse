import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

test("canonical CI Build uses disposable PostgreSQL and applies migrations", () => {
  assert.match(workflow, /name: CI Build/);
  assert.match(workflow, /name: Build/);
  assert.match(workflow, /image: postgres:16-alpine/);
  assert.match(workflow, /POSTGRES_USER: synapse_ci/);
  assert.match(workflow, /POSTGRES_PASSWORD: synapse_ci/);
  assert.match(workflow, /POSTGRES_DB: synapse_ci/);
  assert.match(workflow, /pg_isready -U synapse_ci -d synapse_ci/);
  assert.match(workflow, /DATABASE_URL: postgresql:\/\/synapse_ci:synapse_ci@127\.0\.0\.1:5432\/synapse_ci\?schema=public/);
  assert.match(workflow, /npx prisma generate/);
  assert.match(workflow, /npx prisma migrate deploy/);
});

test("canonical CI gate remains read-only with respect to deployment", () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow, /packages:\s*write/);
  assert.doesNotMatch(workflow, /docker\/login-action/);
  assert.doesNotMatch(workflow, /docker\/build-push-action/);
  assert.doesNotMatch(workflow, /deploy|ssh|scp/i);
});

test("canonical CI still exercises the full application validation contract", () => {
  for (const command of [
    "npm ci --no-audit --no-fund",
    "npm run typecheck",
    "npm run lint",
    "npm test",
    "npm run build",
  ]) {
    assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
