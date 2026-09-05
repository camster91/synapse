import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("backup captures database, uploads, manifest, and checksums without secrets", async () => {
  const script = await readFile("scripts/backup.sh", "utf8");

  assert.match(script, /pg_dump --format=custom --no-owner --no-privileges/);
  assert.match(script, /url\.searchParams\.delete\("schema"\)/);
  assert.match(script, /tar -czf .*uploads\.tar\.gz/);
  assert.match(script, /secrets_included=false/);
  assert.match(script, /shasum -a 256 database\.dump uploads\.tar\.gz manifest\.txt/);
  assert.match(script, /trap cleanup_failed_backup ERR INT TERM/);
});

test("restore drill is explicit, integrity-checked, and validates application state", async () => {
  const script = await readFile("scripts/restore-drill.sh", "utf8");
  const reconcile = await readFile("scripts/reconcile-uploads.ts", "utf8");

  assert.match(script, /RESTORE_CONFIRM:-.*EMPTY_DISPOSABLE_DATABASE/);
  assert.match(script, /shasum -a 256 -c checksums\.sha256/);
  assert.match(script, /pg_restore --exit-on-error --clean --if-exists/);
  assert.match(script, /url\.searchParams\.delete\("schema"\)/);
  assert.match(script, /prisma migrate status/);
  assert.match(script, /Restore upload target must not be a symbolic link/);
  assert.match(
    script,
    /SYNAPSE_UPLOAD_DIR="\$RESTORE_UPLOAD_DIR"[\s\S]*SYNAPSE_UPLOAD_DIR_CONFIRM='restore-drill-disposable-upload-target'[\s\S]*npm run uploads:reconcile/
  );
  assert.match(reconcile, /process\.env\.SYNAPSE_UPLOAD_DIR/);
  assert.match(reconcile, /SYNAPSE_UPLOAD_DIR_CONFIRM/);
  assert.match(reconcile, /restore-drill-disposable-upload-target/);
  assert.match(reconcile, /path\.isAbsolute\(configured\)/);
  assert.match(reconcile, /resolved === root/);
  assert.match(reconcile, /resolved === homedir\(\)/);
  assert.match(reconcile, /resolved === process\.cwd\(\)/);
  assert.match(reconcile, /path\.join\(process\.cwd\(\), "uploads"\)/);
});

test("runbook keeps production recovery gated on owner and operator evidence", async () => {
  const runbook = await readFile("OPERATIONS.md", "utf8");

  assert.match(runbook, /encrypted off-site destination/);
  assert.match(runbook, /target recovery point and recovery time objectives/);
  assert.match(runbook, /backup and recovery remain a release blocker/);
});
