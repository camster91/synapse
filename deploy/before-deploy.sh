#!/usr/bin/env bash
# Execute inside Coolify's build helper before replacing images; fail closed.
set -euo pipefail
resource="${1:?Pass the Coolify application UUID}"
[[ "$resource" =~ ^[a-z0-9]{24}$ ]] || exit 1
mode="${2:-deploy}"
[[ "$mode" = deploy || "$mode" = backup-only ]] || exit 1
if [[ "$mode" = deploy ]]; then
  usage="$(df -P / | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"
  [[ "$usage" =~ ^[0-9]+$ ]] || exit 1
  if (( usage >= 80 )); then
    echo 'Source build blocked by the 80 percent capacity policy; use backup-only for recovery preparation.' >&2
    exit 1
  fi
fi

# Coolify adds a deployment suffix to names. Compose ownership labels remain
# stable; ambiguity or a partially created stack must never back up the legacy
# deployment instead of the requested resource.
app="$(docker ps --filter "label=com.docker.compose.project=$resource" --filter 'label=com.docker.compose.service=app' --format '{{.ID}}')"
db="$(docker ps --filter "label=com.docker.compose.project=$resource" --filter 'label=com.docker.compose.service=db' --format '{{.ID}}')"
if [[ -z "$app" && -z "$db" ]]; then
  existing="$(docker ps -a --filter "label=com.docker.compose.project=$resource" --format '{{.ID}}')"
  [[ -z "$existing" ]] || exit 1
  app=fcb2926ac4767361a3c657683c06586c6700c326-app-1
  db=fcb2926ac4767361a3c657683c06586c6700c326-db-1
else
  [[ "$app" =~ ^[a-f0-9]+$ && "$db" =~ ^[a-f0-9]+$ ]] || exit 1
fi
for container in "$app" "$db"; do
  [[ "$(docker inspect -f '{{.State.Running}}' "$container")" = true ]] || exit 1
done
database_volume="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$db")"
uploads_volume="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}' "$app")"
[[ "$database_volume" = 529a6ddadaf8e9b5ca3bce1c7f7bd4594ca5e2a9_synapse_pgdata || "$database_volume" = synapse-coolify-candidate-db-* ]] || exit 1
[[ "$uploads_volume" = 529a6ddadaf8e9b5ca3bce1c7f7bd4594ca5e2a9_synapse_uploads || "$uploads_volume" = synapse-coolify-candidate-uploads-* ]] || exit 1
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="/app/uploads/.ops-backups/before-deploy-$stamp"
docker exec -u root "$app" sh -ec 'umask 077; mkdir -p "$1"; chmod 700 /app/uploads/.ops-backups' sh "$backup"
docker exec "$db" pg_dump -U synapse -d synapse --format=custom --no-owner --no-privileges |
  docker exec -i -u root "$app" sh -ec 'umask 077; cat > "$1/database.dump"' sh "$backup"
docker exec -u root "$app" cat "$backup/database.dump" |
  docker exec -i "$db" pg_restore --list >/dev/null
docker exec -u root "$app" sh -ec '
  umask 077
  tar --exclude="./.ops-backups" -czf "$1/uploads.tar.gz" -C /app/uploads .
  tar -tzf "$1/uploads.tar.gz" >/dev/null
  cd "$1"
  sha256sum database.dump uploads.tar.gz > checksums.sha256
  sha256sum -c checksums.sha256 >/dev/null
' sh "$backup"
for service in app db; do
  container="$app"
  [[ "$service" = app ]] || container="$db"
  image="$(docker inspect -f '{{.Image}}' "$container")"
  base="synapse-retained-$service-base:$stamp"
  retained="synapse-retained-$service:before-deploy-$stamp"
  docker image tag "$image" "$base"
  printf 'FROM %s\nLABEL coolify.managed="true" ashbi.retired="true"\n' "$base" |
    docker build --network=none -t "$retained" - >/dev/null 2>&1
  [[ "$(docker image inspect -f '{{json .RootFS.Layers}}' "$image")" = "$(docker image inspect -f '{{json .RootFS.Layers}}' "$retained")" ]] || exit 1
done
echo 'PostgreSQL catalog and backup checksums verified; uploads archived; preceding images retained.'
