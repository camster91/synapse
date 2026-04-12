# Synapse

Your second brain — habit tracker, todo, planner, notes, calendar, journal, and AI chat in one app.

## Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Copy env file and configure
cp .env.example .env
# Edit .env with your database URL and API keys

# 3. Set up database (migrate + seed)
npm run setup

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js v5
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
- **Calendar** — Event management with recurrence
- **Goals** — Hierarchical goals (yearly → quarterly → monthly → weekly)
- **Journal** — Daily entries with mood, gratitude, and highlights
- **Inbox** — Quick capture for thoughts before organizing
- **AI Chat** — Natural language interaction with your data via LLM
- **Gamification** — XP, levels, achievements, streaks
- **Plugins** — Installable modules for finance, relationships, reading, etc.