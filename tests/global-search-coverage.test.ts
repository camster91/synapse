import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/search/route.ts", "utf8");
const results = readFileSync("src/components/GlobalSearchResults.tsx", "utf8");
const chat = readFileSync("src/app/(app)/chat/page.tsx", "utf8");

test("global search covers every primary customer content collection", () => {
  for (const model of ["todo", "note", "journal", "goal", "calendarEvent", "habit", "inboxItem", "aiConversation"]) {
    assert.match(route, new RegExp(`prisma\\.${model}\\.findMany`));
  }
  assert.match(route, /where: \{\s*userId,/);
  assert.match(route, /messages: \{ some: \{ content: contains \} \}/);
});

test("new search collections navigate to their truthful product destinations", () => {
  assert.match(results, /key: "habits"[\s\S]*?href: \(\) => "\/habits"/);
  assert.match(results, /key: "inboxItems"[\s\S]*?href: \(\) => "\/inbox"/);
  assert.match(results, /key: "conversations"[\s\S]*?href: \(item\) => `\/chat\?conversation=/);
  assert.match(chat, /new URLSearchParams\(window\.location\.search\)\.get\("conversation"\)/);
  assert.match(chat, /loadedConversations\.some\(\(conversation: Conversation\) => conversation\.id === requestedConversation\)/);
});
