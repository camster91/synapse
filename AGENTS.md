<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Synapse repository contract

Synapse is a private Next.js application backed by PostgreSQL and Prisma. Treat `README.md` as the cold-start guide, `OPERATIONS.md` as the recovery and production operations authority, and `PILOT.md` as the approval-gated validation authority.

## Local workflow

- Use Node.js 24 and npm 11.6.0; `.nvmrc` and `package.json` are the runtime contract.
- Install with `npm ci`; do not regenerate the lockfile unless dependency work is in scope.
- Start disposable PostgreSQL with `docker compose up -d`, copy `.env.example` to `.env`, then run `npm run setup`.
- Run the application with `npm run dev` and the complete local gate with `npm run verify`.
- Tests and local setup must use disposable data. Never point development commands at production data.

## Boundaries

- Prisma migrations are the shared schema authority. Do not replace release-bound migrations with `prisma db push`.
- Preserve encrypted-data compatibility; key rotation requires a migration and rollback plan.
- Do not deploy, change production secrets, restore backups, or alter pilot/release status without explicit approval.
