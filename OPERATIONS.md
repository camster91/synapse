# Synapse Operations Runbook

This runbook covers the repository's verified operator workflows. It is not evidence
of a production deployment. Hosting, off-site storage, alert ownership, recovery
objectives, and retention still require accountable owner decisions.

## Backup contract

A complete backup contains PostgreSQL state and the matching uploads directory.
The backup command creates a private, timestamped directory containing:

- `database.dump`: PostgreSQL custom-format dump without ownership or grants;
- `uploads.tar.gz`: uploaded files, including private staged residue if present;
- `manifest.txt`: format, timestamp, revision, and an explicit no-secrets claim;
- `checksums.sha256`: integrity hashes for every artifact.

The destination must be an absolute path and cannot be `/` or the operator's home
directory. The command removes a partial destination if creation fails. It does not
encrypt artifacts, upload them off-site, or choose retention; use an approved encrypted
backup target with access controls before production.

```bash
DATABASE_URL='postgresql://…' \
SYNAPSE_UPLOAD_DIR='/absolute/path/to/uploads' \
SYNAPSE_BACKUP_DIR='/absolute/path/to/private/backups' \
npm run backup
```

Never pass real credentials in tickets, chat, screenshots, or committed files.

## Restore drill

The drill is deliberately destructive to its target database. Use a newly created,
empty disposable database and an empty disposable uploads directory. It refuses to
run without the exact confirmation value, verifies checksums and archive paths,
restores both stores, confirms Prisma migration state, and reconciles upload metadata.

```bash
SYNAPSE_BACKUP_PATH='/absolute/path/to/one/synapse-backup' \
RESTORE_DATABASE_URL='postgresql://…/synapse_restore_drill' \
RESTORE_UPLOAD_DIR='/absolute/path/to/empty/restore-uploads' \
RESTORE_CONFIRM='EMPTY_DISPOSABLE_DATABASE' \
npm run restore:drill
```

After a successful drill, compare representative record and attachment counts with
the source, record elapsed recovery time, then delete only the explicitly named
disposable database and directory.

## Production gate

Before release, the owner and operator must approve and verify:

1. encrypted off-site destination and least-privilege access;
2. automated schedule, retention, failure alerts, and named responder;
3. target recovery point and recovery time objectives;
4. a restore drill using production-like volume and topology;
5. documented credential restoration/rotation and service rollback;
6. evidence that export, account deletion, and backup retention policies agree.

Until all six are evidenced, backup and recovery remain a release blocker.

## Health and error signals

- `GET /api/health` is a cache-disabled liveness probe. It proves only that the
  process can answer HTTP and reports uptime plus `RELEASE_REV`.
- `GET /api/health/ready` is a cache-disabled readiness probe. It returns `200`
  only after PostgreSQL responds and the uploads directory is readable and writable;
  otherwise it returns `503` without exposing connection or filesystem details.
- The production image runs the readiness probe every 30 seconds and becomes
  unhealthy after three consecutive failures.
- Server startup, readiness failures, and uncaught Next.js request errors emit
  one-line JSON to standard output. Request paths, queries, headers, bodies, error
  messages, and user identifiers are deliberately excluded.

Production still requires a log destination, retention policy, dashboards, alert
thresholds, and a named responder. Recommended release alerts are: any unhealthy
instance for two minutes, request-error rate above 1% for five minutes, backup job
failure, and disk usage above 80%. Vendor selection or paid monitoring requires
owner approval.
