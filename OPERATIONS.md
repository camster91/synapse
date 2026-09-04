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

## Transactional authentication email

Credentials accounts remain unable to sign in until their one-time verification
marker is consumed. Verification and password-reset links expire after 30 minutes,
are stored only as SHA-256 hashes, and are denied after their first successful use.
A successful password reset rotates the private credentials-session version so older
JWT sessions are rejected on their next authenticated server request.

Production delivery uses the fixed Resend REST endpoint and must be explicitly
configured. `AUTH_PUBLIC_URL` is the externally reachable origin placed in email
links; it falls back to `NEXTAUTH_URL`. Raw bearer tokens are placed in URL fragments,
not query strings, and delivery logs contain fixed event/error codes rather than
addresses, token values, message bodies, or provider response bodies.

```bash
EMAIL_PROVIDER='resend' \
RESEND_API_KEY='operator-supplied-secret' \
EMAIL_FROM='Synapse <no-reply@approved-domain.example>' \
EMAIL_REPLY_TO='approved-support@example.com' \
AUTH_PUBLIC_URL='https://approved-beta-host.example'
```

Before external testing, the owner must approve the provider, sender domain, mailbox,
operator, and any spend. Verify SPF, DKIM, and DMARC alignment; deliver registration
and password-reset messages to an operator-controlled mailbox; test expiry and replay
denial; and retain only content-free evidence. Do not copy addresses, links, raw
tokens, headers, or message content into issues or release notes.

For disposable local QA only, `EMAIL_PROVIDER=file` writes private JSON messages to
`AUTH_EMAIL_FILE_DIR`. The application refuses that provider when `NODE_ENV=production`
and refuses any outbox inside `public/`. Treat the directory as secret material,
restrict it to the operator, and delete it after the run.

## Authenticated lifecycle smoke

The lifecycle smoke creates one randomly credentialed synthetic account and now
exercises the complete credentials journey: generic registration response, captured
verification email, single-use verification, sign-in, onboarding, portable export,
password-reset delivery, reset replay denial, old-session invalidation, old-password
rejection, new-password sign-in, wrong-password deletion denial, confirmed deletion,
and failed reauthentication. When `DATABASE_URL` is provided, it also verifies zero
remaining user, authentication-token, session, and representative owned rows.

Run it against a disposable local database. The application and smoke process must
share the same private outbox directory:

```bash
EMAIL_PROVIDER='file' \
AUTH_EMAIL_FILE_DIR='/absolute/private/path/synapse-auth-outbox' \
NEXTAUTH_URL='http://127.0.0.1:3000' \
LIFECYCLE_SMOKE_BASE_URL='http://127.0.0.1:3000' \
LIFECYCLE_SMOKE_CONFIRM='create-and-delete-disposable-account' \
DATABASE_URL='postgresql://…/synapse_disposable' \
npm run smoke:lifecycle
```

The command consumes and deletes the captured token files it uses, but the operator
must still remove any residual outbox files and the disposable database afterward.
The command refuses remote targets by default. A remote run creates and deletes an
account in that deployment and therefore requires explicit release/operator approval
immediately beforehand plus `LIFECYCLE_SMOKE_ALLOW_REMOTE=true`. Never point the
database assertion at a different deployment from the HTTP target. This automated
file-outbox run does not replace the separate external sender/mailbox evidence above.

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
