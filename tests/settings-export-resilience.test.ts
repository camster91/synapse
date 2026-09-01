import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settings = readFileSync("src/app/(app)/settings/page.tsx", "utf8");

test("settings export reports network failures and prevents duplicate downloads", () => {
  assert.match(settings, /if \(exporting\) return/);
  assert.match(settings, /if \(!res\.ok\) throw new Error\("Export request failed"\)/);
  assert.match(settings, /Data export failed\. No archive was downloaded; please try again\./);
  assert.match(settings, /disabled=\{exporting\}/);
  assert.match(settings, /role="alert"/);
  assert.match(settings, /finally \{\s*setExporting\(false\)/);
  assert.match(settings, /document\.body\.appendChild\(a\)/);
  assert.match(settings, /a\.remove\(\)/);
  assert.match(settings, /window\.setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 0\)/);
});
