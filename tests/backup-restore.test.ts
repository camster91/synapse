import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("backup captures only a canonical regular upload tree with integrity metadata", async () => {
  const script = await readFile("scripts/backup.sh", "utf8");

  assert.match(script, /canonical_existing_directory/);
  assert.match(script, /path\.isAbsolute\(input\)/);
  assert.match(script, /Directory path must be absolute/);
  assert.match(script, /fs\.realpathSync\(resolved\)/);
  assert.match(script, /Directory path must not contain symbolic-link components/);
  assert.match(script, /stat\.isSymbolicLink\(\)/);
  assert.match(script, /stat\.nlink !== 1/);
  assert.match(script, /hard-linked file/);
  assert.match(script, /pg_dump --format=custom --no-owner --no-privileges/);
  assert.match(script, /url\.searchParams\.delete\("schema"\)/);
  assert.match(script, /tar -czf .*uploads\.tar\.gz/);
  assert.match(script, /secrets_included=false/);
  assert.match(script, /shasum -a 256 database\.dump uploads\.tar\.gz manifest\.txt/);
  assert.match(script, /trap cleanup_failed_backup ERR INT TERM/);
});

test("restore drill fails closed on archive, target path, and database state", async () => {
  const script = await readFile("scripts/restore-drill.sh", "utf8");
  const reconcile = await readFile("scripts/reconcile-uploads.ts", "utf8");

  assert.match(script, /RESTORE_CONFIRM:-.*EMPTY_DISPOSABLE_DATABASE/);
  assert.match(script, /shasum -a 256 -c checksums\.sha256/);
  assert.match(script, /fs\.realpathSync\(existing\) !== existing/);
  assert.match(script, /symbolic-link components/);
  assert.match(script, /archive_listing="\$\(mktemp\)"/);
  assert.match(script, /tar -tvzf .* > "\$archive_listing"/);
  assert.match(script, /grep -Eq '\^\[lh\]' "\$archive_listing"/);
  assert.doesNotMatch(script, /tar -tvzf[^\n]*\|[^\n]*grep -q/);
  assert.match(script, /symbolic or hard links/);
  assert.match(script, /psql .*--set=ON_ERROR_STOP=1/);
  for (const catalog of [
    "pg_namespace",
    "pg_class",
    "pg_proc",
    "pg_type",
    "pg_collation",
    "pg_conversion",
    "pg_operator",
    "pg_opclass",
    "pg_opfamily",
    "pg_ts_config",
    "pg_ts_dict",
    "pg_ts_parser",
    "pg_ts_template",
    "pg_statistic_ext",
    "pg_extension",
    "pg_event_trigger",
    "pg_publication",
    "pg_subscription",
    "pg_foreign_data_wrapper",
    "pg_foreign_server",
    "pg_user_mapping",
    "pg_transform",
    "pg_largeobject_metadata",
    "pg_am",
    "pg_cast",
    "pg_language",
  ]) {
    assert.match(script, new RegExp(catalog));
  }
  assert.match(
    script,
    /pg_subscription[\s\S]*subdbid = \(SELECT oid FROM pg_database WHERE datname = current_database\(\)\)/
  );
  assert.match(script, /pg_am WHERE oid >= 16384/);
  assert.match(script, /Restore database must be empty/);
  assert.match(script, /pg_restore --exit-on-error --no-owner --no-privileges/);
  assert.doesNotMatch(script, /pg_restore[^\n]*--clean/);
  assert.match(script, /url\.searchParams\.delete\("schema"\)/);
  assert.match(script, /prisma migrate status/);
  assert.match(
    script,
    /SYNAPSE_UPLOAD_DIR_CONFIRM='restore-drill-disposable-upload-target'[\s\S]*npm run uploads:reconcile -- "\$RESTORE_UPLOAD_DIR"/
  );
  assert.doesNotMatch(reconcile, /process\.env\.SYNAPSE_UPLOAD_DIR/);
  assert.match(reconcile, /process\.argv\[2\]/);
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
