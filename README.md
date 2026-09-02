# Synapse

A private daily operating system that connects goals to today across priorities,
habits, calendar context, captures, and reflection—with portable data and optional
bring-your-own AI.

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
└── docker-compose.yml     # PostgreSQL
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
