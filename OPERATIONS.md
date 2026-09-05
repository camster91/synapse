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

The approved backup root and upload root must already exist as absolute canonical
directories. The command rejects filesystem root, the operator home directory, the
current working directory, any root whose literal path resolves through a symbolic-link
component, symbolic links anywhere inside the upload tree, hard-linked upload files,
and non-regular upload entries. This prevents a successful backup from referring to
files outside the intended upload tree or producing an archive that its own restore
workflow cannot safely consume. A partial timestamped destination is removed if backup
creation fails.

The command does not encrypt artifacts, upload them off-site, or choose retention;
use an approved encrypted backup target with least-privilege access before production.

```bash
DATABASE_URL='postgresql://…' \
SYNAPSE_UPLOAD_DIR='/absolute/canonical/path/to/uploads' \
SYNAPSE_BACKUP_DIR='/absolute/canonical/path/to/private/backups' \
npm run backup
```

Never pass real credentials in tickets, chat, screenshots, or committed files.

## Transactional authentication email

Credentials accounts remain blocked until their one-time verification marker is
consumed. Verification and password-reset tokens are random, stored only as SHA-256
hashes, expire after 30 minutes, and are rejected after successful use. Password reset
rotates the private credentials-session version so older JWT sessions are rejected on
their next authenticated server request.

The external adapter uses Resend's HTTPS API. It requires an approved sender, domain,
mailbox, operator, and any associated spend before configuration:

```bash
EMAIL_PROVIDER='resend'
RESEND_API_KEY='operator-supplied-secret'
EMAIL_FROM='Synapse <no-reply@approved-domain.example>'
EMAIL_REPLY_TO='approved-support@example.com'
AUTH_PUBLIC_URL='https://approved-beta-host.example'
```

`AUTH_PUBLIC_URL` falls back to `NEXTAUTH_URL`. Non-loopback authentication origins
must use HTTPS. Raw bearer tokens are placed in URL fragments rather than query
strings, and the browser removes the fragment from its history before submitting the
token to Synapse. Provider calls have a bounded timeout. Operational logs use fixed
codes and omit addresses, token values, message bodies, and provider response bodies.

Before external testing, verify SPF, DKIM, and DMARC alignment, then prove both
registration and password-reset delivery in an operator-controlled mailbox. Exercise
expiry, replay denial, known/unknown-account response parity, desktop/mobile rendering,
and delivery-failure observability without copying private evidence into GitHub.
Configuration alone does not satisfy issue #60.

## Authenticated lifecycle smoke

The lifecycle smoke creates one randomly credentialed synthetic account, signs in,
creates a goal/habit/priority through onboarding, validates a portable export, proves
wrong-password deletion fails without data loss, deletes with the correct credential,
and proves the deleted credential cannot sign in again. When `DATABASE_URL` is
provided, it also verifies zero remaining user and representative owned rows.

Email verification is deliberately separated from this #29 runtime/database exercise.
For a loopback disposable deployment only, the application may use the built-in local
email sink and the smoke command removes only its randomly generated account's pending
verification marker directly from the same disposable database. The sink discards the
email without logging or writing the recipient, body, or raw bearer token. This proves
neither external delivery nor the verification-link journey and **does not satisfy #60**.

For the disposable app process/container only, configure:

```bash
EMAIL_PROVIDER='local-sink'
AUTH_EMAIL_LOCAL_SINK='disposable-lifecycle-only'
NEXTAUTH_URL='http://127.0.0.1:3000'
```

`AUTH_PUBLIC_URL`, when supplied instead of `NEXTAUTH_URL` for authentication links,
must also be loopback for the local sink to activate. Never use the local sink on an
approved beta/public hostname.

Run the lifecycle command against the same disposable database:

```bash
LIFECYCLE_SMOKE_BASE_URL='http://127.0.0.1:3000' \
LIFECYCLE_SMOKE_CONFIRM='create-and-delete-disposable-account' \
DATABASE_URL='postgresql://…/synapse_disposable' \
npm run smoke:lifecycle
```

The command refuses remote targets by default. Although remote authorization still
requires `LIFECYCLE_SMOKE_ALLOW_REMOTE=true` and explicit release/operator approval,
the script will not bypass email verification for a remote hostname. Complete the
approved external-email journey separately under #60 instead of weakening that gate.
Never point the database assertion at a different deployment from the HTTP target.

## Restore drill

Use a newly created, dedicated disposable database and an empty disposable uploads
directory. Do not target `postgres`, `template0`, or `template1`. The drill refuses to
run without the exact confirmation value. It canonicalizes the restore upload target
and rejects linked path components, then verifies backup checksums and fully
materializes archive name/type listings before checking traversal and member types.
Only ordinary regular-file and directory archive members are accepted; symbolic links,
hard links, FIFOs, devices, and other special members fail closed before extraction.
The complete listing is consumed from a file, so validation cannot be short-circuited
by a producer receiving SIGPIPE.

Before import, the drill creates one protected PostgreSQL session. That session disables
new connections to the disposable target, terminates other target sessions, and refuses
to continue if any competing connection remains. The same protected session then runs
the database preflight and applies SQL generated from the backup, eliminating the race
between an emptiness check and restore. A cleanup path reconnects through the standard
`postgres` administrative database to re-enable target connections if the protected
session fails after closing them.

The database preflight requires exactly one standard `public` schema owned by
`pg_database_owner`. It rejects unexpected `public` schema ACLs; outside the owner,
only ordinary non-grantable `USAGE` for `PUBLIC` is accepted. It also queries user
schemas, namespace-owned relations/functions/types/operators/text-search objects,
extensions, event triggers, publications/subscriptions, foreign-data objects,
transforms, large objects, custom access methods/casts, non-default languages, and
pre-existing default ACL rows. Any detected user-defined object, unsafe `public` schema
metadata, default privilege, or competing session fails the empty-target gate.

Because the target is independently verified and isolated, restore does not use
`pg_restore --clean` and does not intentionally drop existing objects. The archive is
rendered to SQL with owner/privilege restoration disabled, then applied with psql
`ON_ERROR_STOP` inside the protected target session. Connections are re-enabled only
after that protected restore completes.

The drill then restores uploads, confirms Prisma migration state, and reconciles the
exact restored upload directory through a restore-only explicit argument. Normal
production startup still reconciles only its standard `./uploads` directory.

```bash
SYNAPSE_BACKUP_PATH='/absolute/path/to/one/synapse-backup' \
RESTORE_DATABASE_URL='postgresql://…/synapse_restore_drill' \
RESTORE_UPLOAD_DIR='/absolute/canonical/path/to/empty/restore-uploads' \
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
  only after PostgreSQL responds, the uploads directory is readable and writable,
  and authentication email configuration passes its non-delivery configuration
  check. Missing or invalid mail configuration therefore keeps the instance out of
  service, but readiness does not prove that an external provider or mailbox works.
- Readiness failures report only fixed failed-check names and the release revision;
  connection strings, provider secrets, recipient addresses, and error messages are
  excluded.
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
