# Synapse Product Control

Authoritative product, market, roadmap, risk, and release record. Technical
implementation detail remains in `BACKLOG.md`; when the two disagree, this file
controls product priority and launch claims.

Last reconciled: 2026-08-28 against branch
`codex/integrated-backlog-hardening`, commit `adf6aa6`, PR #55, and the current
security-remediation working tree.

## Product charter

- **Product:** Synapse, a web-first, self-hostable personal operating system.
- **Primary customer hypothesis:** privacy-conscious technical solo professionals
  whose goals, tasks, habits, notes, calendar, and reflection are fragmented across
  multiple products.
- **Core job:** turn intentions and captured inputs into a realistic daily plan,
  then preserve context through execution and reflection without surrendering
  control of personal data or AI credentials.
- **Promise hypothesis:** one private daily command center connecting goals to
  today, with self-hosting, export, and bring-your-own AI.
- **Initial market assumption:** English-language individual users in Canada and
  the United States. This is unvalidated and must not become a public legal or
  commercial claim without owner approval.
- **Deliberately deferred:** team collaboration, enterprise administration,
  native mobile apps, broad third-party integrations, and autonomous AI mutations.
- **Success definition:** at least 5 target users complete a two-week pilot; 4/5
  independently reach first value in under 10 minutes; at least 3/5 use the daily
  plan on 8 of 14 days; no critical/high release risk or unrecoverable data loss.

## Current state

### Verified

- Private GitHub repository; no homepage or verified production deployment is
  connected to the repository.
- Next.js web/PWA with PostgreSQL and Prisma; production Compose and a standalone
  image exist. Current host has no Docker runtime, so image/database smoke testing
  is blocked.
- Credentials auth, tenant-scoped habits, tasks, notes/backlinks, calendar, goals,
  journal, inbox, gamification, plugins, export, and read-only AI chat tools exist.
- PR #55 has 53 passing local tests, passing typecheck, zero-warning lint, and a
  passing production build. GitHub-hosted jobs fail before checkout with zero steps;
  issue #49 tracks runner availability.
- Guided onboarding, a focused Today loop, portable export, and credential-verified
  account deletion now exist in code and automated coverage. The disposable local
  PostgreSQL environment successfully generated Prisma client code, applied the
  initial migration, seeded reference data, and served the public application.
- Public desktop/mobile rendering and registration field semantics are browser
  verified. Authenticated onboarding, export, and deletion remain browser-verification
  gates pending approval to submit disposable local credentials in the browser.
- No billing, analytics, error monitoring, support path, restore workflow, automated
  backup, terms, or privacy notice exists.
- Recurrence strings are stored but occurrences are not expanded; public copy no
  longer promises recurrence expansion or automatic time blocking.
- AI mutations are implemented internally but intentionally excluded from the chat
  tool list until explicit confirmation UI exists. Current AI value is retrieval and
  context, not safe autonomous execution.
- AI chat now derives provider execution only from the authenticated user's saved
  settings. Anthropic and OpenAI require that user's encrypted key; request-level
  provider/model overrides cannot consume operator credentials. Ollama execution is
  pinned to the instance operator's configured endpoint rather than a tenant URL.

### Inferences

- Breadth is currently a liability during activation: eleven navigation areas appear
  before the customer has completed one useful loop.
- Data control plus connected whole-life planning is a more credible differentiation
  path than matching Akiflow/Motion integrations or Notion/Capacities knowledge depth.
- BYOK AI can lower inference cost and strengthen control, but setup friction means it
  should be optional after first value rather than required during onboarding.

### Unknowns

- No verified customers, interviews, usage analytics, retention, revenue, support
  demand, willingness to pay, or production reliability evidence was found.
- Hosting provider, domain, operational owner, budget, legal entity, support channel,
  backup target, and acceptable recovery objectives are unknown.
- The repository MIT license contains placeholder copyright fields. Correct ownership
  wording requires accountable owner confirmation.

## Access register

| Capability | State | Approval or owner action | Release consequence |
|---|---|---|---|
| Repository and GitHub | Available; authenticated | Approval required to merge if it releases | PR work can continue |
| Local Node build/test | Available | None | Verified |
| Docker runtime | Unavailable | Install/provide runtime or CI runner | Blocks image and migration smoke test |
| GitHub-hosted runners | Unavailable before checkout | Account runner/quota/billing owner | Blocks authoritative PR checks |
| Production hosting/domain | Unknown | Owner selection and credentials | Blocks release |
| Analytics/monitoring/logs | Absent | Product implementation; vendor spend needs approval | Blocks launch evidence |
| Billing | Absent | Pricing and payment approval | Blocks paid launch, not pilot |
| Customers/feedback/support | No evidence/access | Owner recruits or authorizes outreach | Blocks customer validation |
| Legal identity/policies | Unknown/absent | Owner/legal approval | Blocks public commercial launch |

## Market evidence (researched 2026-08-28)

First-party published pricing establishes three relevant clusters:

| Alternative | Position and current published price | What it proves | Synapse gap/opportunity |
|---|---|---|---|
| [Todoist](https://www.todoist.com/pricing/) | General task management; free, Pro $5/user/month annually | Low-cost task execution is mature and crowded | Do not compete on todos alone |
| [Notion](https://www.notion.com/pricing) | Flexible knowledge/work platform; free, Plus $10, Business $20/member/month | Broad workspace and AI depth set a high breadth bar | Win on guided daily coherence and control, not databases |
| [Capacities](https://capacities.io/pricing) | Connected personal knowledge; free, Pro $9.99/month, paid AI power-up | Personal knowledge plus AI already has a focused entrant | Synapse must make action/reflection linkage tangible |
| [Sunsama](https://www.sunsama.com/pricing) | Guided daily planning; $17/month annually or $22 monthly | Customers may pay premium prices for a calm daily ritual | A proven daily-planning value frame, but no Synapse validation |
| [Akiflow](https://akiflow.com/pricing) | Integrated task/calendar daily planning; $19/month annually or $34 monthly | Integrations and time blocking command premium pricing | Synapse currently lacks equivalent integrations and scheduling |
| [Motion](https://www.usemotion.com/pricing?tool=motion) | AI work suite; Pro AI $19/seat/month annually | Bundled AI planning is crowded and credit-metered | BYOK/control can differentiate if onboarding remains simple |
| [Vikunja](https://vikunja.io/pricing/) | Open-source self-hosted tasks; cloud €4/month or €40/year | Self-hosting alone is not a premium differentiator | Whole-life daily loop must justify any price premium |
| [Anytype](https://business.anytype.io/) | Local-first encrypted workspace; business €20/editor/month | Stronger sovereignty claims require real local-first/E2EE architecture | Do not call Synapse local-first or zero-knowledge |

Research stop rule: first-party evidence covers the consequential positioning and
price anchors. Customer pain and switching evidence remain insufficient and require
interviews/pilot behavior rather than more vendor pages.

## Position and packaging hypothesis

- **Wedge:** technical solo professionals willing to self-host or use a managed
  private instance, who want one daily loop across work and life.
- **Differentiators to earn:** goals-to-today planning; habits/tasks/calendar/journal
  in one daily review; inspectable self-hosting and complete export/deletion; optional
  BYOK AI with explicit confirmation and undo.
- **Reasons to switch:** fewer disconnected daily rituals, ownership/control, and a
  price below premium planners without subsidizing bundled AI.
- **Proposed packaging, not approved or customer-visible:** free MIT self-hosted
  community edition; managed individual beta at $12/month annually or $15 monthly,
  with a 14-day no-card trial; AI uses customer keys initially. Pricing requires
  customer interviews, cost measurement, license correction, and owner approval.

## Metrics and decision rules

No baselines exist. Instrument only with documented consent and minimal data.

| Metric | Pilot target | Decision rule |
|---|---|---|
| Activation | Create first daily plan in <10 minutes; >=80% of pilot users | Repair onboarding before adding breadth if missed |
| Daily-plan success | >=70% of planned priority items resolved or consciously rescheduled | Rework plan workflow if missed |
| 14-day engaged retention | >=60% use on 8+ days | Do not proceed to paid launch if missed |
| Export success | 100% of representative accounts produce a complete readable archive | Release blocker |
| Account deletion | 100% removal of DB records and owned files in tests | Release blocker |
| AI suggestion acceptance | >=60% accepted without correction on evaluation set | Keep mutations disabled if missed |
| Reliability | >=99.5% successful requests in pilot, no Sev-1 data loss | Release blocker |

## Authoritative roadmap

1. **Activation and truthful promise — implemented; public runtime verified, authenticated journey pending.**
   - Outcome: new user completes a focused setup and reaches a useful Today plan.
   - Acceptance: onboarding routes from registration; creates or skips one goal,
     habit, and priority task; ends on Today with a visible next action; empty,
     failure, retry, keyboard, and mobile states covered; unsupported landing claims
     removed.
   - Registration now enters a focused goal/habit/priority-task setup with an explicit
     skip path; records are created atomically and Today receives the first priority.
     Public landing access and product copy now match implemented behavior.
   - Evidence: activation contracts, typecheck, zero-warning lint, and production build
     pass. A disposable PostgreSQL database migrated and seeded successfully; desktop
     and 390 px public views render without clipping, and registration fields resolve
     by accessible label. Account submission and the authenticated continuation remain
     pending action-time browser approval.
2. **Data lifecycle and trust — implemented in code; runtime and policy evidence pending.**
   - Portable JSON export includes profile, content, attachment records and embedded
     bytes, plugins, notifications, and an explicit credential-exclusion manifest.
     Credential-verified account deletion removes cascaded records and stages uploaded
     files recoverably; individual attachment deletion now uses the same recovery model.
   - Evidence: lifecycle contracts plus existing file rollback tests, typecheck,
     zero-warning lint, and production build pass. Database-backed export/deletion,
     restore, owner-approved policies, and backup drill remain release gates.
3. **Daily plan vertical loop — implemented; automated/build verified, runtime journey pending.**
   - Connect inbox triage, top priorities, habits, real calendar events, deliberate
     rescheduling, and end-of-day reflection in one Today workflow.
   - Today returns focused goal-linked priorities, daily habits, active goals, schedule
     context, and recent inbox captures. Users can complete tasks/habits, deliberately
     move work to tomorrow, triage captures, and close the day with a reflection in
     place; failures restore optimistic state or preserve the reflection draft.
   - Evidence: 53 tests, typecheck, zero-warning lint, and production build pass.
     Timezone-backed runtime tests and database/browser verification remain.
4. **Production-like pilot readiness — blocked.**
   - Docker image/migrations, health/authenticated smoke test, monitoring, backups,
     rollback, support path, and five-user pilot protocol. Blocked by runtime/hosting,
     runner, legal/support decisions, and customer access.
5. **AI evaluation and confirmation — proposed.**
   - Representative evaluation set, privacy disclosure, cost/latency tracking,
     explicit mutation confirmation, correction/undo, outage behavior.
6. **Pricing validation and billing — proposed.**
   - Measure costs and willingness to pay; obtain owner approval before any public
     price or payment behavior; implement cancellation and entitlement recovery.

## Decision log

- **2026-08-28 — Position on private daily execution, not generic breadth.**
  Evidence: current product shape plus first-party competitor positioning/pricing.
  Alternatives: generic second brain, AI work suite, task manager, team workspace.
  Reversal condition: target-user interviews show a different urgent job and actual
  switching intent. Owner: product owner; state: proposed/researched, not approved.
- **2026-08-28 — Keep AI mutations read-only until confirmation exists.**
  Evidence: mutation executors exist, but no safe confirmation/undo UX or evaluation.
  Reversal condition: confirmation, authorization, evaluation, and recovery pass.
  State: implemented safety constraint.

## Risk and blocker register

| Severity | Risk | Mitigation/state | Owner |
|---|---|---|---|
| Critical | No production backup/restore evidence | Roadmap item 2/4; release blocked | Product owner + operator |
| High | Export/deletion lack authenticated runtime and restore-drill evidence | Roadmap item 2 | Engineering |
| High | Onboarding lacks authenticated browser completion evidence | Roadmap item 1 in progress | Engineering/product |
| High | CI jobs never receive a runner | GitHub issue #49 | Account owner |
| High | Image/migrations untested together | GitHub issue #29 | Operator |
| High | No legal identity, privacy, or terms | Owner/legal approval required | Product owner |
| Medium | Landing promise needs customer comprehension and conversion evidence | Public copy is implementation-truthful; validate in pilot | Product |
| Medium | No analytics or monitoring | Add privacy-respecting pilot telemetry | Product owner |
| Medium | AI quality, privacy, latency, and cost unmeasured | Keep mutations disabled; item 5 | Engineering/product |
| Resolved | Raw browser-push delivery permitted tenant-controlled outbound requests | Unsafe sender removed; in-app notifications remain until standards-compliant Web Push exists | Engineering |
| Resolved | Uploads lacked aggregate tenant/storage quotas | Atomic 512 MB account reservations, migration backfill, and deletion release verified | Engineering |
| Medium | Staged-file unlink failures can retain private trash files | Add durable reconciliation and operator visibility | Engineering |
| Medium | MIT license copyright placeholders | Confirm holder/year before edit | Product owner |

## Release record and work log

- No verified production release or customer pilot.
- 2026-08-28: PR #55 implemented and locally verified the security/reliability
  backlog; hosted validation remains blocked before checkout.
- 2026-08-28: market baseline, positioning hypothesis, access register, metrics,
  risks, and roadmap established from live repository and first-party sources.
- 2026-08-28: activation journey and truthful public promise implemented; 44 tests,
  typecheck, lint, and production build passed.
- 2026-08-28: secret-safe portable export and recoverable account/attachment deletion
  implemented; 48 tests, typecheck, lint, and production build passed.
- 2026-08-28: first executable Today loop implemented with goal context and recoverable
  task/habit completion; 51 tests, typecheck, lint, and production build passed.
- 2026-08-28: Today loop completed in code with focused selection, tomorrow deferral,
  inbox triage, and draft-preserving reflection; 53 tests, typecheck, lint, and
  production build passed.
- 2026-08-28: isolated local PostgreSQL migration and seed passed; public desktop and
  mobile browser captures verified the revised goals-to-today positioning. Registration
  and login now expose programmatic labels, autocomplete intent, and live error regions.
- 2026-08-28: repository-wide offline security review validated six findings: one
  high, four medium, and one low. The highest-risk shared-AI-credential path and the
  tenant-controlled Ollama destination were remediated in code; 58 tests, typecheck,
  zero-warning lint, and the production build pass. Upload quotas and file
  reconciliation remain release-gate work.
- 2026-08-28: unsafe raw browser-push delivery and subscription registration were
  removed. Notifications remain available in-app, the PWA service worker still
  registers, and browser push is explicitly deferred until a standards-compliant,
  destination-constrained implementation exists; 61 tests pass.
- 2026-08-28: attachment storage gained an atomic 512 MB per-account quota with
  migration backfill, compensating cleanup for failed uploads, and quota release
  across direct and parent-record deletion. The migration and concurrent boundary
  behavior were verified against isolated PostgreSQL; 65 tests, typecheck, and
  zero-warning lint pass.
