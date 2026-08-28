import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync("next.config.ts", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");

test("all application routes receive explicit browser security headers", () => {
  for (const header of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "Referrer-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Permissions-Policy",
  ]) {
    assert.match(config, new RegExp(header));
  }
  assert.match(config, /source: "\/:path\*"/);
});

test("CSP blocks framing, plugins, and broad inline script execution", () => {
  assert.match(config, /object-src 'none'/);
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(config, /script-src 'self'/);
  assert.doesNotMatch(config, /script-src[^\n]*unsafe-inline/);
});

test("theme bootstrap is external so it works with the script policy", () => {
  assert.match(layout, /<Script src="\/theme-init\.js" strategy="beforeInteractive" \/>/);
  assert.doesNotMatch(layout, /dangerouslySetInnerHTML/);
});
