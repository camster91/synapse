import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settingsRoute = readFileSync("src/app/api/settings/route.ts", "utf8");
const settingsPage = readFileSync("src/app/(app)/settings/page.tsx", "utf8");

test("settings API refuses changing the verified email identity during RC1", () => {
  assert.match(settingsRoute, /EMAIL_CHANGE_REQUIRES_VERIFICATION/);
  assert.match(settingsRoute, /requestedEmail !== currentEmail/);
  assert.match(settingsRoute, /Email changes require verification and are unavailable during the managed beta/);
  assert.match(settingsRoute, /status: 409/);
  assert.match(settingsRoute, /data\.email = currentIdentity\.email/);
});

test("settings identity responses are private and operational errors use fixed codes", () => {
  assert.match(settingsRoute, /const noStoreHeaders = \{ "Cache-Control": "no-store" \}/);
  assert.match(settingsRoute, /headers: noStoreHeaders/);
  assert.match(settingsRoute, /settings_fetch_failed/);
  assert.match(settingsRoute, /settings_update_failed/);
  assert.doesNotMatch(settingsRoute, /console\.error\("Failed to (?:fetch|update) settings:", error\)/);
});

test("settings UI presents email as read-only instead of inviting an unsupported mutation", () => {
  assert.match(settingsPage, /type="email"/);
  assert.match(settingsPage, /readOnly/);
  assert.match(settingsPage, /aria-readonly="true"/);
  assert.match(settingsPage, /Email changes are not available in this beta/);

  const saveBody = settingsPage.slice(
    settingsPage.indexOf("body: JSON.stringify({"),
    settingsPage.indexOf("}),", settingsPage.indexOf("body: JSON.stringify({")) + 3,
  );
  assert.doesNotMatch(saveBody, /\bemail\s*:/);
});
