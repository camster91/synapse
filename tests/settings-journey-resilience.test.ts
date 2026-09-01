import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settings = readFileSync("src/app/(app)/settings/page.tsx", "utf8");

test("settings cannot silently present failed profile loading as editable data", () => {
  assert.match(settings, /if \(!r\.ok\) throw new Error\("Settings request failed"\)/);
  assert.match(settings, /Unable to load settings\. Refresh the page and try again\./);
  assert.match(settings, /disabled=\{saving \|\| !settingsLoaded\}/);
});

test("email accurately communicates the beta editing boundary", () => {
  assert.match(settings, /type="email"[\s\S]*?readOnly[\s\S]*?aria-readonly="true"/);
  assert.match(settings, /Email changes are not available in this beta\./);
  assert.doesNotMatch(settings, /type="email"[\s\S]{0,180}onChange=/);
});
