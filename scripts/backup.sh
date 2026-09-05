#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SYNAPSE_BACKUP_DIR:?SYNAPSE_BACKUP_DIR must be an absolute backup directory}"

case "$SYNAPSE_BACKUP_DIR" in
  /*) ;;
  *) echo "SYNAPSE_BACKUP_DIR must be absolute" >&2; exit 2 ;;
esac

if [[ "$SYNAPSE_BACKUP_DIR" == "/" || "$SYNAPSE_BACKUP_DIR" == "$HOME" ]]; then
  echo "Refusing unsafe backup root" >&2
  exit 2
fi
if [[ -L "$SYNAPSE_BACKUP_DIR" ]]; then
  echo "Backup root must not be a symbolic link" >&2
  exit 2
fi

upload_dir="${SYNAPSE_UPLOAD_DIR:-$PWD/uploads}"
case "$upload_dir" in
  /*) ;;
  *) echo "SYNAPSE_UPLOAD_DIR must be absolute" >&2; exit 2 ;;
esac
if [[ "$upload_dir" == "/" || "$upload_dir" == "$HOME" || "$upload_dir" == "$PWD" ]]; then
  echo "Refusing unsafe upload root" >&2
  exit 2
fi
if [[ ! -d "$upload_dir" ]]; then
  echo "Upload directory does not exist: $upload_dir" >&2
  exit 2
fi
if [[ -L "$upload_dir" ]]; then
  echo "Upload directory must not be a symbolic link" >&2
  exit 2
fi
if [[ -n "$(find "$upload_dir" -type l -print -quit)" ]]; then
  echo "Upload directory contains symbolic links; refusing unsafe backup" >&2
  exit 2
fi

umask 077
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$SYNAPSE_BACKUP_DIR/synapse-$timestamp"
if [[ -e "$destination" ]]; then
  echo "Backup destination already exists: $destination" >&2
  exit 2
fi

mkdir -p "$destination"
cleanup_failed_backup() {
  rm -rf -- "$destination"
}
trap cleanup_failed_backup ERR INT TERM

postgres_url="$(node -e '
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.delete("schema");
  process.stdout.write(url.toString());
')"
pg_dump --format=custom --no-owner --no-privileges \
  --file="$destination/database.dump" "$postgres_url"
tar -czf "$destination/uploads.tar.gz" -C "$upload_dir" .

revision="unknown"
if command -v git >/dev/null 2>&1; then
  revision="$(git rev-parse HEAD 2>/dev/null || printf 'unknown')"
fi

cat > "$destination/manifest.txt" <<EOF
format=synapse-backup-v1
created_at_utc=$timestamp
git_revision=$revision
contents=database.dump,uploads.tar.gz
secrets_included=false
EOF

(
  cd "$destination"
  shasum -a 256 database.dump uploads.tar.gz manifest.txt > checksums.sha256
)

trap - ERR INT TERM
echo "$destination"
