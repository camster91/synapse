#!/usr/bin/env bash
set -euo pipefail

: "${SYNAPSE_BACKUP_PATH:?SYNAPSE_BACKUP_PATH must name one backup directory}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL must name an empty disposable database}"
: "${RESTORE_UPLOAD_DIR:?RESTORE_UPLOAD_DIR must be an absolute disposable directory}"

if [[ "${RESTORE_CONFIRM:-}" != "EMPTY_DISPOSABLE_DATABASE" ]]; then
  echo "Set RESTORE_CONFIRM=EMPTY_DISPOSABLE_DATABASE to authorize the destructive drill" >&2
  exit 2
fi

case "$SYNAPSE_BACKUP_PATH" in /*) ;; *) echo "SYNAPSE_BACKUP_PATH must be absolute" >&2; exit 2 ;; esac
case "$RESTORE_UPLOAD_DIR" in /*) ;; *) echo "RESTORE_UPLOAD_DIR must be absolute" >&2; exit 2 ;; esac

RESTORE_UPLOAD_DIR="$(TARGET_PATH="$RESTORE_UPLOAD_DIR" node <<'NODE'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const resolved = path.resolve(process.env.TARGET_PATH);
if (resolved === path.parse(resolved).root || resolved === os.homedir() || resolved === process.cwd()) {
  console.error(`Refusing unsafe restore upload target: ${resolved}`);
  process.exit(2);
}

let existing = resolved;
while (!fs.existsSync(existing)) {
  const parent = path.dirname(existing);
  if (parent === existing) {
    console.error(`Could not locate an existing restore-target ancestor: ${resolved}`);
    process.exit(2);
  }
  existing = parent;
}
if (fs.realpathSync(existing) !== existing) {
  console.error(`Restore upload target path must not contain symbolic-link components: ${resolved}`);
  process.exit(2);
}
if (fs.existsSync(resolved)) {
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory()) {
    console.error(`Restore upload target is not a directory: ${resolved}`);
    process.exit(2);
  }
  if (fs.realpathSync(resolved) !== resolved) {
    console.error(`Restore upload target must not resolve through a symbolic link: ${resolved}`);
    process.exit(2);
  }
}
process.stdout.write(resolved);
NODE
)"

for file in database.dump uploads.tar.gz manifest.txt checksums.sha256; do
  if [[ ! -f "$SYNAPSE_BACKUP_PATH/$file" ]]; then
    echo "Backup is incomplete: missing $file" >&2
    exit 2
  fi
done

(
  cd "$SYNAPSE_BACKUP_PATH"
  shasum -a 256 -c checksums.sha256
)

archive_names="$(mktemp)"
archive_listing="$(mktemp)"
restore_sql="$(mktemp)"
connections_closed=0
postgres_admin_url=""
restore_database_name=""

reenable_target_connections() {
  if [[ "$connections_closed" != "1" || -z "$postgres_admin_url" || -z "$restore_database_name" ]]; then
    return 0
  fi

  psql "$postgres_admin_url" --no-psqlrc --set=ON_ERROR_STOP=1 --set=target_db="$restore_database_name" >/dev/null <<'SQL'
SELECT format('ALTER DATABASE %I ALLOW_CONNECTIONS true', :'target_db') \gexec
SQL
  connections_closed=0
}

cleanup_restore_drill() {
  status=$?
  set +e
  reenable_target_connections
  rm -f -- "$archive_names" "$archive_listing" "$restore_sql"
  exit "$status"
}
trap cleanup_restore_drill EXIT

tar -tzf "$SYNAPSE_BACKUP_PATH/uploads.tar.gz" > "$archive_names"
while IFS= read -r entry; do
  case "$entry" in
    /*|../*|*/../*|*/..) echo "Unsafe upload archive entry: $entry" >&2; exit 2 ;;
  esac
done < "$archive_names"

tar -tvzf "$SYNAPSE_BACKUP_PATH/uploads.tar.gz" > "$archive_listing"
if grep -Evq '^[-d]' "$archive_listing"; then
  echo "Upload archive contains non-regular or non-directory entries; refusing unsafe restore" >&2
  exit 2
fi

if [[ -d "$RESTORE_UPLOAD_DIR" && -n "$(find "$RESTORE_UPLOAD_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
  echo "Restore upload target must be empty" >&2
  exit 2
fi

mapfile -t postgres_connection < <(RESTORE_DATABASE_URL="$RESTORE_DATABASE_URL" node <<'NODE'
const target = new URL(process.env.RESTORE_DATABASE_URL);
target.searchParams.delete('schema');
const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''));
if (!databaseName || ['postgres', 'template0', 'template1'].includes(databaseName)) {
  console.error('RESTORE_DATABASE_URL must name a dedicated disposable database');
  process.exit(2);
}
const admin = new URL(target);
admin.pathname = '/postgres';
process.stdout.write(`${target.toString()}\n${admin.toString()}\n${databaseName}\n`);
NODE
)

postgres_restore_url="${postgres_connection[0]:-}"
postgres_admin_url="${postgres_connection[1]:-}"
restore_database_name="${postgres_connection[2]:-}"
if [[ -z "$postgres_restore_url" || -z "$postgres_admin_url" || -z "$restore_database_name" ]]; then
  echo "Could not resolve disposable restore database connection details" >&2
  exit 2
fi

# Generate SQL before closing target connections. Execution happens later through
# one protected psql session so the emptiness check and restore cannot be raced.
pg_restore --no-owner --no-privileges \
  --file="$restore_sql" "$SYNAPSE_BACKUP_PATH/database.dump"

connections_closed=1
{
  cat <<'SQL'
\set ON_ERROR_STOP on

-- Freeze the disposable database before validating it. The current psql session
-- remains connected; new connections are refused until the restore completes.
SELECT format('ALTER DATABASE %I ALLOW_CONNECTIONS false', current_database()) \gexec
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();

DO $synapse_connections$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
  ) THEN
    RAISE EXCEPTION 'Restore database still has another active connection';
  END IF;
END
$synapse_connections$;

DO $synapse_preflight$
DECLARE
  existing_objects bigint;
  system_schema_objects bigint;
  public_schema_owner text;
  unsafe_public_acl bigint;
BEGIN
  IF (SELECT count(*) FROM pg_namespace WHERE nspname = 'public') <> 1 THEN
    RAISE EXCEPTION 'Restore database must contain exactly one standard public schema';
  END IF;

  SELECT pg_get_userbyid(nspowner)
    INTO public_schema_owner
    FROM pg_namespace
    WHERE nspname = 'public';
  IF public_schema_owner <> 'pg_database_owner' THEN
    RAISE EXCEPTION 'Restore database public schema has unexpected owner: %', public_schema_owner;
  END IF;

  SELECT count(*)
    INTO unsafe_public_acl
    FROM pg_namespace n
    CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl
    WHERE n.nspname = 'public'
      AND acl.grantee <> n.nspowner
      AND NOT (
        acl.grantee = 0
        AND acl.privilege_type = 'USAGE'
        AND NOT acl.is_grantable
      );
  IF unsafe_public_acl <> 0 THEN
    RAISE EXCEPTION 'Restore database public schema has unexpected privileges';
  END IF;

  -- PostgreSQL reserves OIDs below FirstNormalObjectId (16384) for built-in/initdb
  -- objects. Any namespace-owned object at or above that boundary inside a system
  -- schema was created later and makes this supposed disposable target non-pristine.
  SELECT count(*)
    INTO system_schema_objects
    FROM (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND c.oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND p.oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND t.oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_collation c JOIN pg_namespace n ON n.oid = c.collnamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND c.oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_conversion c JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND c.oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_operator o JOIN pg_namespace n ON n.oid = o.oprnamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND o.oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_opclass o JOIN pg_namespace n ON n.oid = o.opcnamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND o.oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_opfamily o JOIN pg_namespace n ON n.oid = o.opfnamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND o.oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_ts_config c JOIN pg_namespace n ON n.oid = c.cfgnamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND c.oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_ts_dict d JOIN pg_namespace n ON n.oid = d.dictnamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND d.oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_ts_parser p JOIN pg_namespace n ON n.oid = p.prsnamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND p.oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_ts_template t JOIN pg_namespace n ON n.oid = t.tmplnamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND t.oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_statistic_ext s JOIN pg_namespace n ON n.oid = s.stxnamespace
        WHERE n.nspname IN ('pg_catalog', 'information_schema') AND s.oid >= 16384
    ) AS user_created_system_schema_objects;

  IF system_schema_objects <> 0 THEN
    RAISE EXCEPTION 'Restore database system schemas contain % user-created object(s)', system_schema_objects;
  END IF;

  SELECT count(*)
    INTO existing_objects
    FROM (
      SELECT 1 FROM pg_namespace
        WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'public')
          AND nspname !~ '^pg_(toast|temp)'
      UNION ALL
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_collation c JOIN pg_namespace n ON n.oid = c.collnamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_conversion c JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_operator o JOIN pg_namespace n ON n.oid = o.oprnamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_opclass o JOIN pg_namespace n ON n.oid = o.opcnamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_opfamily o JOIN pg_namespace n ON n.oid = o.opfnamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_ts_config c JOIN pg_namespace n ON n.oid = c.cfgnamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_ts_dict d JOIN pg_namespace n ON n.oid = d.dictnamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_ts_parser p JOIN pg_namespace n ON n.oid = p.prsnamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_ts_template t JOIN pg_namespace n ON n.oid = t.tmplnamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_statistic_ext s JOIN pg_namespace n ON n.oid = s.stxnamespace
        WHERE n.nspname = 'public'
      UNION ALL
      SELECT 1 FROM pg_extension WHERE extname <> 'plpgsql'
      UNION ALL
      SELECT 1 FROM pg_event_trigger
      UNION ALL
      SELECT 1 FROM pg_publication
      UNION ALL
      SELECT 1 FROM pg_subscription
        WHERE subdbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      UNION ALL
      SELECT 1 FROM pg_foreign_data_wrapper
      UNION ALL
      SELECT 1 FROM pg_foreign_server
      UNION ALL
      SELECT 1 FROM pg_user_mapping
      UNION ALL
      SELECT 1 FROM pg_transform
      UNION ALL
      SELECT 1 FROM pg_largeobject_metadata
      UNION ALL
      SELECT 1 FROM pg_am WHERE oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_cast WHERE oid >= 16384
      UNION ALL
      SELECT 1 FROM pg_default_acl
      UNION ALL
      SELECT 1 FROM pg_prepared_xacts WHERE database = current_database()
      UNION ALL
      SELECT 1 FROM pg_language
        WHERE lanname NOT IN ('internal', 'c', 'sql', 'plpgsql')
    ) AS user_defined_objects;

  IF existing_objects <> 0 THEN
    RAISE EXCEPTION 'Restore database must be empty; found % user-defined object(s)', existing_objects;
  END IF;
END
$synapse_preflight$;
SQL
  cat "$restore_sql"
  cat <<'SQL'

-- Re-open the disposable target only after the protected restore finishes.
SELECT format('ALTER DATABASE %I ALLOW_CONNECTIONS true', current_database()) \gexec
SQL
} | psql "$postgres_restore_url" --no-psqlrc --set=ON_ERROR_STOP=1 >/dev/null
connections_closed=0

mkdir -p "$RESTORE_UPLOAD_DIR"
tar -xzf "$SYNAPSE_BACKUP_PATH/uploads.tar.gz" -C "$RESTORE_UPLOAD_DIR"

DATABASE_URL="$RESTORE_DATABASE_URL" npx prisma migrate status >/dev/null
SYNAPSE_UPLOAD_DIR_CONFIRM='restore-drill-disposable-upload-target' \
DATABASE_URL="$RESTORE_DATABASE_URL" \
npm run uploads:reconcile -- "$RESTORE_UPLOAD_DIR" >/dev/null

echo "Restore drill passed: database migrations and upload reconciliation are healthy"
