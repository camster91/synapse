#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SYNAPSE_BACKUP_DIR:?SYNAPSE_BACKUP_DIR must be an absolute backup directory}"

canonical_existing_directory() {
  TARGET_PATH="$1" node <<'NODE'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const input = process.env.TARGET_PATH;
if (!path.isAbsolute(input)) {
  console.error(`Directory path must be absolute: ${input}`);
  process.exit(2);
}
const resolved = path.resolve(input);
let stat;
try {
  stat = fs.lstatSync(resolved);
} catch {
  console.error(`Directory does not exist: ${resolved}`);
  process.exit(2);
}
if (!stat.isDirectory()) {
  console.error(`Path is not a directory: ${resolved}`);
  process.exit(2);
}
const canonical = fs.realpathSync(resolved);
if (canonical !== resolved) {
  console.error(`Directory path must not contain symbolic-link components: ${resolved}`);
  process.exit(2);
}
if (resolved === path.parse(resolved).root || resolved === os.homedir() || resolved === process.cwd()) {
  console.error(`Refusing unsafe directory root: ${resolved}`);
  process.exit(2);
}
process.stdout.write(resolved);
NODE
}

backup_root="$(canonical_existing_directory "$SYNAPSE_BACKUP_DIR")"
upload_dir="$(canonical_existing_directory "${SYNAPSE_UPLOAD_DIR:-$PWD/uploads}")"

UPLOAD_ROOT="$upload_dir" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const root = process.env.UPLOAD_ROOT;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    const stat = fs.lstatSync(fullPath);
    if (stat.isSymbolicLink()) {
      console.error(`Upload tree contains a symbolic link: ${fullPath}`);
      process.exit(2);
    }
    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!stat.isFile()) {
      console.error(`Upload tree contains a non-regular file: ${fullPath}`);
      process.exit(2);
    }
    if (stat.nlink !== 1) {
      console.error(`Upload tree contains a hard-linked file: ${fullPath}`);
      process.exit(2);
    }
  }
}
walk(root);
NODE

umask 077
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$backup_root/synapse-$timestamp"
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
