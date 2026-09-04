# Synapse

A private daily operating system that connects goals to today across priorities,
habits, calendar context, captures, and reflection—with portable data and optional
bring-your-own AI.

## Current project state

Synapse is in **RC1 managed-beta validation**, not public launch.

Canonical control plane:

- `PRODUCT.md` — product position, evidence, risks, and release boundaries;
- `BACKLOG.md` — technical implementation/verification state;
- GitHub issue #71 — governing execution order;
- `OPERATIONS.md` / `OPERATIONS-RC1.md` — runtime, backup, restore, alerts, and evidence;
- `SUPPORT.md` — beta support/incident operating model;
- `LEGAL-REVIEW-INVENTORY.md` — factual legal/data review inventory;
- `RELEASE-RC1.md` — exact-artifact release approval flow;
- `PILOT.md` — five-user, 14-day no-billing validation protocol.

The integrated RC1 baseline before the current documentation reconciliation is
`0c05e7037b5d07029401aad2d6515ef6c243a08c`. It is a candidate, not an approved
deployment artifact. Runtime, governance, external email, operations, policy/support,
rendered QA, customer validation, and exact-artifact release gates remain open.

GitHub-hosted canonical CI is currently not usable as release evidence because jobs
have repeatedly failed before checkout with zero executed steps. Do not interpret that
as an application pass or failure.

## Quick Start

```bash
# 1. Install dependencies
npm ci

# 2. Start PostgreSQL
docker compose up -d

# 3. Copy env file and configure (macOS/Linux)
cp .env.example .env
# PowerShell: Copy-Item .env.example .env
# Edit .env with your database URL, auth secret, and 32-byte encryption key

# 4. Set up database (generate, migrate, and seed)
npm run setup

# 5. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js v4
- **Styling**: Tailwind CSS v4
- **AI**: Multi-provider (Anthropic, OpenAI, Ollama)
- **Plugins**: Custom plugin system with permissions

## Database Commands

```bash
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run migrations
npm run db:seed        # Seed achievements & plugins
npm run db:studio      # Open Prisma Studio GUI
npm run db:reset       # Reset database
```

## Validation

```bash
npm test               # Contract and regression tests
npm run typecheck      # TypeScript validation
npm run lint           # ESLint with zero warnings allowed
npm run build          # Production Next.js build
```

RC1-specific commands include:

```bash
npm run smoke:lifecycle
npm run backup
npm run restore:drill
npm run ops:preflight
npm run ops:evidence
npm run metrics:support
npm run release:validate -- /absolute/path/to/release-package.json
```

These commands have explicit safety/evidence boundaries. Read `OPERATIONS.md` and
`RELEASE-RC1.md` before using them. A passing local command does not itself authorize
remote execution, deployment, destructive restore, or release.

Production Compose files fail closed when required secrets are absent. Before any
managed-beta deployment, the exact candidate must pass the runtime, external-email,
recovery, governance, policy/support, rendered-QA, and release-package gates tracked
by roadmap #71.

## Project Structure

```text
synapse/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Seed data
│   └── migrations/        # Migration files
├── plugins/               # Plugin manifests & code
├── src/
│   ├── app/               # App Router pages and APIs
│   ├── components/        # React components
│   └── lib/               # auth, AI, plugins, validation, data helpers
├── scripts/               # validation, lifecycle, backup/restore, metrics, release tools
├── PRODUCT.md             # product/release control
├── BACKLOG.md             # technical execution control
├── OPERATIONS.md          # operator runbook
├── SUPPORT.md             # beta support/incident model
├── PILOT.md               # managed-beta protocol
└── docker-compose.yml     # local PostgreSQL
```

## Features

- **Habits** — Track daily/weekly habits with streaks
- **Todos / Today** — Task management, priorities, and focused daily planning
- **Notes** — Notes with backlinks (`[[wikilinks]]`)
- **Calendar** — Event management and daily schedule context
- **Goals** — Hierarchical goals and goal-linked planning
- **Journal** — Daily entries, gratitude, highlights, and reflection
- **Inbox** — Quick capture before organizing
- **Export / deletion** — Portable data export and credential-confirmed account deletion
- **AI Chat** — Natural-language interaction with user-controlled provider settings
- **Gamification** — XP, levels, achievements, streaks
- **Plugins** — Permissioned installable modules

## Release boundaries

The current intended milestone is one invite-only managed beta for five specifically
approved testers, 14 measured days, no billing, and no public launch. It requires a
separate exact-artifact approval after all evidence gates pass.

Post-beta billing (#69), Adaptive Planning (#74–#77/#80 and draft PR #79), and routine
dependency PRs (#59/#72/#73) remain outside the frozen RC1 scope unless the governing
roadmap is explicitly changed.
