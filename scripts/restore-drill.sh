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
if [[ "$RESTORE_UPLOAD_DIR" == "/" || "$RESTORE_UPLOAD_DIR" == "$HOME" ]]; then
  echo "Refusing unsafe restore upload target" >&2
  exit 2
fi
if [[ -L "$RESTORE_UPLOAD_DIR" ]]; then
  echo "Restore upload target must not be a symbolic link" >&2
  exit 2
fi

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

while IFS= read -r entry; do
  case "$entry" in
    /*|../*|*/../*|*/..) echo "Unsafe upload archive entry: $entry" >&2; exit 2 ;;
  esac
done < <(tar -tzf "$SYNAPSE_BACKUP_PATH/uploads.tar.gz")

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
    --command "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname !~ '^pg_toast' AND c.relkind IN ('r','p','v','m','S','f');" \
    | tr -d '[:space:]'
)"
if [[ "$existing_objects" != "0" ]]; then
  echo "Restore database must be empty; found $existing_objects existing object(s)" >&2
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
