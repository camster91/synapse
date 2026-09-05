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
cleanup_archive_inspection() {
  rm -f -- "$archive_names" "$archive_listing"
}
trap cleanup_archive_inspection EXIT

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

postgres_restore_url="$(RESTORE_DATABASE_URL="$RESTORE_DATABASE_URL" node -e '
  const url = new URL(process.env.RESTORE_DATABASE_URL);
  url.searchParams.delete("schema");
  process.stdout.write(url.toString());
')"

existing_objects="$(
  psql "$postgres_restore_url" --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 \
    --command "
      SELECT count(*) FROM (
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
        SELECT 1 FROM pg_language
          WHERE lanname NOT IN ('internal', 'c', 'sql', 'plpgsql')
      ) AS user_defined_objects;
    " | tr -d '[:space:]'
)"
if [[ "$existing_objects" != "0" ]]; then
  echo "Restore database must be empty; found $existing_objects user-defined object(s)" >&2
  exit 2
fi

# The target was independently verified empty above, so do not use --clean here.
# Omitting destructive drop behavior makes a mistaken or raced target fail closed.
pg_restore --exit-on-error --no-owner --no-privileges \
  --dbname="$postgres_restore_url" "$SYNAPSE_BACKUP_PATH/database.dump"
mkdir -p "$RESTORE_UPLOAD_DIR"
tar -xzf "$SYNAPSE_BACKUP_PATH/uploads.tar.gz" -C "$RESTORE_UPLOAD_DIR"

DATABASE_URL="$RESTORE_DATABASE_URL" npx prisma migrate status >/dev/null
SYNAPSE_UPLOAD_DIR_CONFIRM='restore-drill-disposable-upload-target' \
DATABASE_URL="$RESTORE_DATABASE_URL" \
npm run uploads:reconcile -- "$RESTORE_UPLOAD_DIR" >/dev/null

echo "Restore drill passed: database migrations and upload reconciliation are healthy"
