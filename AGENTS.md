<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Synapse repository instructions

## Product and current direction

Synapse is a web-first, self-hostable personal operating system that connects goals, tasks, habits, notes, calendar context, captures, and reflection into a realistic daily plan while preserving user control of personal data and AI credentials.

The current product/release direction is controlled by `PRODUCT.md`. Do not turn backlog breadth, historical plans, or implementation availability into a launch claim. Team collaboration, enterprise administration, native mobile apps, broad third-party integrations, and autonomous AI mutations are deliberately deferred unless current product authority changes them.

## Authority and reading order

Use repository sources in this order:

1. `AGENTS.md` — durable coding-agent execution and safety rules.
2. `PRODUCT.md` — authoritative product, market, roadmap, risk, and release record.
3. `README.md` — representative setup, stack, and basic validation commands.
4. `BACKLOG.md` — technical implementation detail; it does not override `PRODUCT.md` on product priority or launch claims.
5. `OPERATIONS.md`, `OPERATIONS-RC1.md`, `PILOT.md`, and current release/evidence documents for operational and release work.
6. `.github/workflows/ci.yml` and package scripts for the current mechanical merge gate.
7. Open GitHub issues and pull requests for live work, blockers, and exact-head verification evidence.

`CLAUDE.md` intentionally points to this file. Keep shared instructions here rather than duplicating them into agent-specific files.

Historical or superseded plans may remain useful evidence, but they must not silently override current product/release authority.

## Architecture

- Next.js 16 / React 19 application.
- PostgreSQL with Prisma ORM.
- NextAuth credentials/authentication flows and tenant-scoped personal data.
- Tailwind CSS v4.
- Optional multi-provider AI with user-controlled provider settings/keys.
- Permissioned plugin system.
- User uploads/filesystem state must be considered together with PostgreSQL for backup/recovery.
- `src/app/` — UI routes and API routes.
- `src/lib/` — auth, AI, plugins, validation, data/service logic.
- `prisma/` — schema and migrations; committed migrations are the shared database source of truth.
- `scripts/` — operational, release, smoke, metrics, backup, and evidence tooling.

Before changing a sensitive boundary, read the relevant product/operations document and existing tests rather than inferring behaviour from the UI alone.

## Environment and development

Use the committed lockfile and `npm ci`. CI currently verifies on Node.js 24 even though `package.json` accepts Node >=22; prefer the CI runtime for reproducibility unless a current branch intentionally changes the contract.

Representative local startup is documented in `README.md` and uses local PostgreSQL via Docker Compose, `.env.example`, Prisma setup, and `npm run dev`.

Never use a shared/staging/production database for local setup, migration experiments, `db:reset`, restore drills, lifecycle smoke tests, or destructive verification. Use explicitly disposable databases and directories.

`.env.example` and `.env.operations.example` contain placeholders only. Never commit real database credentials, auth secrets, encryption keys, provider keys, email-provider secrets, user content, production URLs that expose private infrastructure, or private evidence.

## Verification

On current `main`, the canonical CI merge gate is `.github/workflows/ci.yml`. It installs locked dependencies, generates Prisma, applies committed migrations to disposable PostgreSQL, then runs:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Draft PR #91 separately proposes `verify:quick` / `verify` convenience commands and Node-environment alignment. Until that work is merged, do not claim those commands exist on `main` or duplicate its `README.md`, `package.json`, or `.nvmrc` changes in unrelated work.

Additional gates are scope-dependent. Examples include lifecycle smoke, backup/restore drill, operations preflight/evidence validation, release-package validation, pilot metrics, and rendered/browser validation. Use only the checks relevant to the change and current release contract.

A check counts only when it actually ran successfully against the applicable code/artifact. A queued, unavailable, superseded, or infrastructure-failed run is neither a pass nor proof of an application defect. For release-adjacent work, preserve exact commit/artifact provenance.

Never weaken tests, migrations, security controls, privacy boundaries, required CI, or release evidence rules merely to obtain green status.

## Database and data safety

- Treat committed Prisma migrations as authoritative for shared environments.
- Use `prisma migrate deploy` for release-like migration proof against disposable PostgreSQL; do not substitute `db push` as shared schema history.
- `npm run db:reset` is destructive and must be limited to explicitly disposable local/test data.
- Backup correctness spans PostgreSQL plus matching uploads/filesystem state.
- Restore drills are deliberately destructive to their target and require the safeguards in `OPERATIONS.md`; never point them at real user/shared data without exact authorization.
- Preserve tenant isolation and user ownership on every query/mutation.
- Account deletion/export/backup-retention behaviour is a privacy and release boundary, not routine CRUD.

## Security and privacy

- Never expose or commit real secrets, bearer tokens, auth links, provider responses containing private data, user identifiers, message bodies, uploaded personal data, or production connection strings.
- Use synthetic accounts and disposable data for test evidence.
- Preserve enumeration-neutral auth flows, verification/reset-token safety, session revocation, HTTPS requirements for remote authentication links, and privacy-minimal logs.
- AI provider execution must remain scoped to the authenticated user's configured provider/key boundaries; do not silently consume operator credentials for tenant requests.
- Do not enable autonomous AI mutations without the current explicit-confirmation/product approval gate.
- Do not claim Synapse is local-first, zero-knowledge, clinically secure, production-proven, or commercially validated unless current repository evidence supports that exact claim.

If a suspected real credential is discovered, stop handling the value and report only the repository/path and remediation requirement.

## Web QA

For UI changes, verify representative rendered layouts when browser execution is available:

- Mobile: approximately 390 px.
- Tablet: approximately 768 px.
- Desktop: approximately 1440 px.

Check the affected flow plus navigation, keyboard operation, focus visibility/management, forms and validation, links, loading/error/empty states, responsive behaviour, console errors, accessibility basics, auth/deep-link behaviour where relevant, and obvious performance regressions.

For irreversible or account/data actions, use synthetic disposable accounts and keep the action behind its explicit confirmation gate. Do not infer rendered/browser success from source inspection alone.

## Environments and production boundary

Repository evidence currently establishes local/disposable development and CI/release tooling; `PRODUCT.md` must be consulted for the latest verified deployment/hosting state. Do not infer a production environment merely because Docker/Compose/release artifacts exist.

Agents may inspect, implement, test, document, branch, commit, create issues, and open draft pull requests when authorised for the task. Without Cameron explicitly approving the exact difficult-to-reverse action, agents must not:

- merge a pull request;
- deploy production or alter a live host;
- publish/tag a release;
- apply migrations to shared/production data;
- restore or delete shared/production data;
- change DNS, hosting, firewall/network exposure, credentials, secrets, permissions, access, billing, email-provider spend, or monitoring spend;
- send customer/user communications;
- recruit or contact pilot users;
- make legal/commercial claims or approve legal documents.

Configuration or a prepared release package is not authorization to execute production operations.

## Operations, deployment, and rollback

Follow `OPERATIONS.md` and the current RC1/release evidence documents. Operations readiness requires real evidence for backup destination/access, schedule/retention/alerts, accountable responder, recovery objectives, restore drill, credential restoration/rotation, and data-retention consistency.

Keep source verification separate from deployment evidence. A successful build or image creation does not prove the target environment, external email delivery, backups, alerts, legal readiness, customer validation, or rollback.

If the actual target, rollback mechanism, previous artifact, recovery objective, or operational owner is unverified, report it as unknown/blocked rather than inventing it.

## Definition of done and handoff

Use Cameron's status model:

1. Completed and verified
2. Completed but awaiting verification
3. In progress
4. Blocked
5. Awaiting client or teammate
6. Next action

Do not report **Completed and verified** unless the required checks/evidence actually ran or were inspected successfully.

Every substantial coding handoff should include:

- branch;
- exact commit(s);
- pull request;
- files changed;
- implementation summary;
- checks actually executed and their result;
- CI/release evidence inspected for the exact head/artifact;
- screenshots/URLs only when actually captured or verified;
- data/migration/rollback impact;
- remaining risks and blockers;
- production/release status;
- next action and any approval gate.
