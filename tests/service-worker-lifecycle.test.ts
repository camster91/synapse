import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const providers = readFileSync("src/components/Providers.tsx", "utf8");
const bell = readFileSync("src/components/NotificationBell.tsx", "utf8");
const settings = readFileSync("src/app/(app)/settings/page.tsx", "utf8");
const worker = readFileSync("public/sw.js", "utf8");

test("development cannot retain a production service worker or stale Synapse caches", () => {
  assert.match(providers, /process\.env\.NODE_ENV !== "production"/);
  assert.match(providers, /registration\.unregister\(\)/);
  assert.match(providers, /key\.startsWith\("synapse-"\)/);
  assert.match(providers, /register\("\/sw\.js"\)/);
  assert.doesNotMatch(bell, /register\("\/sw\.js"\)/);
  assert.match(worker, /CACHE_NAME = "synapse-v3"/);
});

test("settings theme state starts identically on server and client", () => {
  assert.match(settings, /const \[darkMode, setDarkMode\] = useState\(false\)/);
  assert.match(settings, /setDarkMode\(document\.documentElement\.classList\.contains\("dark"\)\)/);
  assert.doesNotMatch(settings, /useState\(\s*typeof window/);
});
