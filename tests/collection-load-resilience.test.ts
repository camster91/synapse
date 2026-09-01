import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const errorState = readFileSync("src/components/ResourceLoadError.tsx", "utf8");

for (const resource of ["todos", "habits", "goals"] as const) {
  test(`${resource} load failures cannot masquerade as empty data`, () => {
    const page = readFileSync(`src/app/(app)/${resource}/page.tsx`, "utf8");
    const title = resource[0].toUpperCase() + resource.slice(1);
    assert.ok(page.includes(`if (!response.ok) throw new Error("${title} request failed")`));
    assert.match(page, /setLoadError\(true\)/);
    assert.match(page, new RegExp(`ResourceLoadError resource=\"${resource}\"`));
    assert.doesNotMatch(page, /\.catch\(\(\) => \{\}\)/);
  });
}

for (const [resource, title] of [
  ["inbox", "Inbox"],
  ["notes", "Notes"],
  ["calendar", "Calendar"],
  ["journal", "Journal"],
] as const) {
  test(`${resource} load failures cannot masquerade as usable or empty data`, () => {
    const page = readFileSync(`src/app/(app)/${resource}/page.tsx`, "utf8");
    assert.ok(page.includes(`if (!response.ok) throw new Error("${title} request failed")`));
    assert.match(page, /setLoadError\(true\)/);
    assert.match(page, new RegExp(`ResourceLoadError resource="${resource}"`));
    assert.doesNotMatch(page, /\.catch\(\(\) => \{\}\)/);
  });
}

test("journal cannot overwrite an entry before its source data loads", () => {
  const page = readFileSync("src/app/(app)/journal/page.tsx", "utf8");
  assert.match(page, /if \(loading\) return/);
  assert.match(page, /disabled=\{saving \|\| loading\}/);
});

test("achievements failure cannot masquerade as zero progress", () => {
  const page = readFileSync("src/app/(app)/achievements/page.tsx", "utf8");
  assert.match(page, /if \(!response\.ok\) throw new Error\("Achievements request failed"\)/);
  assert.match(page, /ResourceLoadError resource="achievements"/);
  assert.doesNotMatch(page, /\.catch\(\(\) => \{\}\)/);
});

test("notifications distinguish failed loading and failed mutations from emptiness", () => {
  const bell = readFileSync("src/components/NotificationBell.tsx", "utf8");
  assert.match(bell, /Unable to load notifications/);
  assert.match(bell, /onClick=\{loadNotifications\}/);
  assert.match(bell, /if \(!response\.ok\) throw new Error\("Mark read failed"\)/);
  assert.match(bell, /role="alert"/);
});

test("plugin reads and mutations fail visibly without claiming success", () => {
  const page = readFileSync("src/app/(app)/plugins/page.tsx", "utf8");
  assert.match(page, /ResourceLoadError resource="plugins"/);
  assert.match(page, /if \(!allRes\.ok \|\| !userRes\.ok\) throw new Error/);
  assert.match(page, /Nothing was changed/);
  assert.match(page, /previous state was preserved/);
  assert.match(page, /previous settings were preserved/);
  assert.match(page, /role="alert"/);
});

test("chat history and deletion failures preserve truthful conversation state", () => {
  const page = readFileSync("src/app/(app)/chat/page.tsx", "utf8");
  assert.match(page, /if \(!response\.ok\) throw new Error\("Conversations request failed"\)/);
  assert.match(page, /if \(!messagesResponse\.ok \|\| !actionsResponse\.ok\) throw new Error/);
  assert.match(page, /ResourceLoadError resource="conversation history"/);
  assert.match(page, /if \(!response\.ok\) throw new Error\("Conversation delete failed"\)/);
  assert.match(page, /It remains available/);
  assert.doesNotMatch(page, /\.catch\(\(\) => \{\}\)/);
});

test("collection recovery explains data safety and provides an accessible retry", () => {
  assert.match(errorState, /role="alert"/);
  assert.match(errorState, /Your data has not been replaced or removed/);
  assert.match(errorState, /onClick=\{onRetry\}/);
  assert.match(errorState, /Try again/);
  assert.match(errorState, /min-h-11/);
});
