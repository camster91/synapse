import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const exportRoute = readFileSync("src/app/api/settings/export/route.ts", "utf8");
const accountRoute = readFileSync("src/app/api/account/route.ts", "utf8");
const attachmentRoute = readFileSync("src/app/api/attachments/[id]/route.ts", "utf8");
const settingsPage = readFileSync("src/app/(app)/settings/page.tsx", "utf8");

test("portable export covers profile, content, attachments, plugins, and notifications", () => {
  for (const field of ["profile", "attachments", "installedPlugins", "notifications", "contentBase64"]) {
    assert.match(exportRoute, new RegExp(field));
  }
  assert.match(exportRoute, /AI provider API keys/);
  assert.doesNotMatch(exportRoute, /password hashes[^\n]*:/);
});

test("account deletion requires confirmation and credential verification", () => {
  assert.match(accountRoute, /z\.literal\("DELETE"\)/);
  assert.match(accountRoute, /bcrypt\.compare/);
  assert.match(accountRoute, /where: \{ userId: session\.user\.id/);
});

test("account and individual attachment deletion stage files recoverably", () => {
  for (const source of [accountRoute, attachmentRoute]) {
    assert.match(source, /stageFilesForDeletion/);
    assert.match(source, /rollback\(\)/);
    assert.match(source, /commit\(\)/);
  }
});

test("settings explains irreversible deletion and secure export exclusions", () => {
  assert.match(settingsPage, /Type DELETE to confirm/);
  assert.match(settingsPage, /This cannot be undone/);
  assert.match(settingsPage, /reusable credentials are excluded for security/);
});
