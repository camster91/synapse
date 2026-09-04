# Synapse

A private daily operating system that connects goals to today across priorities,
habits, calendar context, captures, and reflection—with portable data and optional
bring-your-own AI.

## Quick Start

Use Node 24 (the same major version used by CI) and npm with the committed
`package-lock.json`.

```bash
# 1. Select the supported runtime when using nvm
nvm use

# 2. Install locked dependencies
npm ci

# 3. Start the local-only PostgreSQL service
docker compose up -d

# 4. Create local configuration without overwriting an existing file
test -e .env || cp .env.example .env
# PowerShell: if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Replace the placeholder auth/encryption values before starting the app.

# 5. Generate Prisma, apply development migrations, and seed the local database
npm run setup

# 6. Start the representative developer server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). PostgreSQL listens on
`localhost:5432`. The default Compose credentials and database are for local
development only.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL 16 + Prisma ORM
- **Auth**: NextAuth.js v4
- **Styling**: Tailwind CSS v4
- **AI**: Multi-provider (Anthropic, OpenAI, Ollama)
- **Plugins**: Custom plugin system with permissions

## Database Commands

```bash
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Apply/create migrations against the configured development database
npm run db:seed        # Seed achievements and plugins
npm run db:studio      # Open Prisma Studio
npm run db:reset       # DESTRUCTIVE: erase and recreate the configured database
```

Run database commands only after confirming `DATABASE_URL` points to a
disposable local or test database. Do not run `db:reset` against shared,
staging, or production data.

## Validation

```bash
npm run verify:quick   # Typecheck, lint, and contract/regression tests
npm run verify         # Merge-level gate: quick checks plus production build
```

CI additionally starts disposable PostgreSQL, generates Prisma, and applies
migrations before running the same underlying typecheck, lint, test, and build
checks. The standard source/build verification does not require AI provider
keys. Release, lifecycle-smoke, backup, and restore checks remain separate
environment-specific gates.

Production Compose files fail closed when required secrets are absent. Before a
real deployment, keep browser push disabled until a standards-compliant sender is
configured, then smoke-test the built application and database together in the
target environment.

Backup creation, destructive restore-drill safeguards, and the remaining production
recovery gates are documented in [OPERATIONS.md](OPERATIONS.md).

The approval-gated five-user validation workflow is documented in
[PILOT.md](PILOT.md).

## Project Structure

```
synapse/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Seed data
│   └── migrations/        # Migration files
├── plugins/               # Plugin manifests & code
│   ├── finance-tracker/
│   └── relationship-crm/
├── src/
│   ├── app/
│   │   ├── (app)/         # Authenticated pages
│   │   │   ├── habits/
│   │   │   ├── todos/
│   │   │   ├── notes/
│   │   │   ├── calendar/
│   │   │   ├── goals/
│   │   │   ├── journal/
│   │   │   ├── chat/
│   │   │   ├── plugins/
│   │   │   ├── achievements/
│   │   │   └── settings/
│   │   ├── api/           # API routes
│   │   ├── login/
│   │   └── register/
│   ├── components/        # React components
│   └── lib/
│       ├── ai/            # AI provider, context, tools
│       ├── plugins/       # Plugin system
│       ├── auth.ts        # NextAuth config
│       ├── prisma.ts      # DB client
│       ├── validators.ts  # Zod schemas
│       └── xp.ts          # Gamification logic
└── docker-compose.yml     # Local PostgreSQL
```

## Features

- **Habits** — Track daily/weekly habits with streaks
- **Todos** — Kanban-style task management with priorities
- **Notes** — Notion-style notes with backlinks (`[[wikilinks]]`)
- **Calendar** — Event management and a daily schedule view
- **Goals** — Hierarchical goals (yearly → quarterly → monthly → weekly)
- **Journal** — Daily entries with mood, gratitude, and highlights
- **Inbox** — Quick capture for thoughts before organizing
- **AI Chat** — Natural language interaction with your data via LLM
- **Gamification** — XP, levels, achievements, streaks
- **Plugins** — Permissioned installable modules; bundled examples cover finance and relationship CRM workflows
