import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const todayPage = readFileSync("src/components/TodayPage.tsx", "utf8");
const dashboard = readFileSync("src/components/DashboardPage.tsx", "utf8");

test("adaptive apply refreshes Today without remounting the dashboard", () => {
  assert.match(todayPage, /<DashboardPage refreshKey=\{revision\} \/>/);
  assert.doesNotMatch(todayPage, /<DashboardPage key=\{revision\}/);
  assert.match(dashboard, /DashboardPage\(\{ refreshKey = 0 \}/);
  assert.match(dashboard, /\}, \[refreshKey\]\);/);
});

test("in-place refresh preserves controlled capture and reflection drafts", () => {
  assert.match(dashboard, /const \[quickCapture, setQuickCapture\] = useState\(""\)/);
  assert.match(dashboard, /const \[reflection, setReflection\] = useState\(""\)/);
  assert.match(dashboard, /setData\(normalizeDashboard\(raw\)\)/);
  assert.doesNotMatch(dashboard, /setQuickCapture\(""\).*refreshKey/s);
  assert.doesNotMatch(dashboard, /setReflection\(""\).*refreshKey/s);
});
