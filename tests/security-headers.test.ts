import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync("next.config.ts", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const middleware = readFileSync("src/proxy.ts", "utf8");

test("all application routes receive explicit browser security headers", () => {
  for (const header of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "Referrer-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Permissions-Policy",
  ]) {
    assert.match(`${config}\n${middleware}`, new RegExp(header));
  }
  assert.match(middleware, /Content-Security-Policy/);
});

test("CSP blocks framing, plugins, and broad inline script execution", () => {
  assert.match(middleware, /object-src 'none'/);
  assert.match(middleware, /frame-ancestors 'none'/);
  assert.match(middleware, /script-src 'self' 'nonce-\$\{nonce\}' 'strict-dynamic'/);
  assert.doesNotMatch(middleware, /script-src[^\n]*unsafe-inline/);
  assert.match(middleware, /requestHeaders\.set\("x-nonce", nonce\)/);
});

test("theme bootstrap is external so it works with the script policy", () => {
  assert.match(layout, /<Script nonce=\{nonce\} src="\/theme-init\.js" strategy="beforeInteractive" \/>/);
  assert.match(layout, /\(await headers\(\)\)\.get\("x-nonce"\)/);
  assert.doesNotMatch(layout, /dangerouslySetInnerHTML/);
});
