# Synapse migration to Coolify

Use a private GitHub application, branch main, raw Docker Compose at
`/deploy/coolify.yml`. This configuration retains the existing Dockerfile,
PostgreSQL 16 and migration/upload reconciliation startup contract. It requires
pre-existing volumes so that an accidental fresh database cannot silently
replace the original.

Original production storage, verified October 2, 2026:

- Database: `529a6ddadaf8e9b5ca3bce1c7f7bd4594ca5e2a9_synapse_pgdata`
- Uploads: `529a6ddadaf8e9b5ca3bce1c7f7bd4594ca5e2a9_synapse_uploads`
- Proxy destination: `127.0.0.1:3070`

Set `SYNAPSE_DATABASE_VOLUME` and `SYNAPSE_UPLOADS_VOLUME` to those existing
names at cutover. Preserve the original database password, auth origin/secrets
and encryption key in Coolify without logging them. The database URL uses the
`db` service alias in the isolated Compose network. Preserve configured
provider values; migration itself must not send emails or request AI actions.

Set the custom Compose build command to:

```sh
bash deploy/before-deploy.sh <application-uuid> && docker compose --project-name <application-uuid> build --pull
```

The guard validates the PostgreSQL dump catalog, archives uploads excluding
previous backups, verifies backup checksums and retains filesystem-identical
preceding images with cleanup protection. Backups are root-only under
`/app/uploads/.ops-backups`; they are not public attachment files. Catalog
validation is not a full restore rehearsal. Before cutover, verify the dump
in an isolated PostgreSQL restore and coordinate upload writes for a consistent
application snapshot.

First deploy against separate existing candidate database/upload volumes,
using a verified PostgreSQL restore and upload snapshot, private port 13070
and isolated auth/provider configuration. Never start another PostgreSQL
server against the production data volume.

Before initial cutover and every deployment, verify a fresh database backup,
retain the preceding images and snapshot uploads with the application writes
coordinated. Configure and test the deployment backup guard before enabling
automatic deployments. Review all pending Prisma migrations for compatibility
with the preceding app version; a successful build alone does not prove safe
data rollback.

The current main revision is 43 commits ahead of the original live image.
Its upload reconciliation removes files not referenced by attachment rows
and staged trash. Inventory these differences and verify a complete upload
backup before promotion; do not infer a safe cutover from matching port or
database names. The three pending migrations add quota/consent fields and
product-event/AI-proposal tables; rollback compatibility still needs an
isolated database and preceding-image rehearsal.

Stop the original app and database only during the prepared single-writer
cutover; start the Coolify stack on the same port with the same volumes.
Leave the shared proxy unchanged. Verify `/api/health/ready`, authentication,
existing user content and uploads through the original HTTPS domain. Test a
signed main deployment against an exact revision before retiring the old
containers. Keep them stopped and recoverable until acceptance.

Rollback restores the original app/database runtime with the recorded images,
auth/encryption configuration and original volume identities. If a migration
is incompatible, restore the verified database snapshot with both database
writers stopped. Never delete Docker volumes.
