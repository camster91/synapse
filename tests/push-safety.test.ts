import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("notification delivery never fetches tenant subscription endpoints", async () => {
  const sender = await readFile("src/lib/push.ts", "utf8");

  assert.doesNotMatch(sender, /fetch\s*\(/);
  assert.doesNotMatch(sender, /pushSubscription\.findMany/);
  assert.match(sender, /return prisma\.notification\.create/);
});

test("the beta rejects browser push registration without persisting endpoints", async () => {
  const route = await readFile("src/app/api/push/subscribe/route.ts", "utf8");

  assert.match(route, /status: 501/);
  assert.doesNotMatch(route, /request\.json|req\.json|pushSubscription\.(create|upsert)/);
});

test("the notification UI does not advertise unavailable browser push", async () => {
  const bell = await readFile("src/components/NotificationBell.tsx", "utf8");
  const providers = await readFile("src/components/Providers.tsx", "utf8");

  assert.doesNotMatch(bell, /usePushNotifications|Enable push|BellOff/);
  assert.match(bell, /<Bell className=/);
  assert.doesNotMatch(bell, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(providers, /register\("\/sw\.js"\)/);
});
