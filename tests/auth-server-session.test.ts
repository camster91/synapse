import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("server auth uses the NextAuth v4 getServerSession API", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/auth.ts"), "utf8");

  assert.match(source, /getServerSession\(authOptions\)/);
  assert.doesNotMatch(source, /NextAuth\(authOptions\)\.auth\(\)/);
});
