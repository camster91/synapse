import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type Lockfile = {
  packages: Record<string, { version?: string }>;
};

test("the lockfile resolves every alerted dependency to its patched version", async () => {
  const lock = JSON.parse(await readFile("package-lock.json", "utf8")) as Lockfile;
  const expected = new Map([
    ["node_modules/deepmerge-ts", "8.0.0"],
    ["node_modules/nanoid", "3.3.18"],
    ["node_modules/find-my-way", "9.7.0"],
    ["node_modules/valibot", "1.4.2"],
    ["node_modules/@babel/core", "7.29.7"],
  ]);

  for (const [packagePath, patchedVersion] of expected) {
    assert.equal(lock.packages[packagePath]?.version, patchedVersion, packagePath);
  }
});

test("Prisma's pinned vulnerable merge dependency is overridden explicitly", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(packageJson.overrides?.["deepmerge-ts"], "8.0.0");
});
