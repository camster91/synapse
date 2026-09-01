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
- PR #55 has 70 passing local tests, passing typecheck, zero-warning lint, and a
  passing production build. GitGuardian passes; Ashbi Local CI is queued and issue
  #49 tracks runner availability.
- The five current Dependabot alerts on the default branch are resolved in this PR
  branch: `deepmerge-ts` 8.0.0, `nanoid` 3.3.18, `find-my-way` 9.7.0,
  `valibot` 1.4.2, and `@babel/core` 7.29.7. Both full and production-only
  `npm audit` report zero vulnerabilities; the default-branch alerts remain visible
  until the branch is merged.
- Guided onboarding, a focused Today loop, portable export, and credential-verified
  account deletion now exist in code and automated coverage. The disposable local
  PostgreSQL environment successfully generated Prisma client code, applied the
  initial migration, seeded reference data, and served the public application.
- Public desktop/mobile rendering and registration field semantics are browser
  verified. Authenticated onboarding, export, and deletion remain browser-verification
  gates pending approval to submit disposable local credentials in the browser.
- No billing, product analytics, external log destination/alerts, support path,
  automated off-site backup, terms, or privacy notice exists. Local liveness,
  database/filesystem readiness, privacy-minimal structured error logs, backup
  creation, and restore-drill tooling are implemented and locally verified.
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
| Analytics/monitoring/logs | Local health and structured signals implemented; collection/alerts absent | Operator destination and ownership; vendor spend needs approval | Blocks launch evidence |
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

No real-customer baselines exist. Activation, Today engagement, and export success
now use explicit opt-in, fixed-name, day-deduplicated events stored in the private
instance. The aggregate report emits no account identifiers or activity content and
remains decision-ineligible below five consented participants. Daily-plan resolution,
AI acceptance, and production reliability still require scoped instrumentation.

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
4. **Production-like pilot readiness — partially implemented; blocked.**
   - Docker image/migrations, health/authenticated smoke test, monitoring, backups,
     rollback, support path, and five-user pilot protocol. Blocked by runtime/hosting,
     runner, legal/support decisions, and customer access.
   - Privacy-minimal pilot measurement is implemented for first-plan activation,
     distinct-day Today engagement, and successful export. Consent defaults off,
     Settings explains the fixed signals, opt-out deletes them atomically, exports
     disclose them, and `npm run metrics:pilot` returns aggregates only. Synthetic
     PostgreSQL verification proved migration, daily deduplication, target rules,
     empty-state reporting, and deletion; it is not customer evidence.
5. **AI evaluation and confirmation — task-creation slice implemented; broader evaluation pending.**
   - Representative evaluation set, privacy disclosure, cost/latency tracking,
     explicit mutation confirmation, correction/undo, outage behavior.
   - Task creation is now the only confirmable AI mutation exposed to chat. The
     model can persist a normalized proposal, but only an authenticated, tenant-
     scoped confirmation route can create the task. Review cards show all stored
     parameters; proposals expire after 30 minutes; duplicate decisions are claimed
     once; rejection changes nothing; and a 10-minute undo deletes only an unchanged
     AI-created task. Edited tasks fail closed instead of losing user work. Proposal
     and decision history is durable and included in portable export.
   - `npm run metrics:ai-actions` reports confirmation, rejection, expiration, and
     undo aggregates only for users who opted into pilot measurement. It deliberately
     does not claim to replace the representative quality evaluation set. Other AI
     mutations remain disabled pending equivalent confirmation and recovery design.
   - A provider-neutral 16-case evaluation contract and deterministic scorer now cover
     task intent/parameters, ambiguity, read-only requests, unsupported mutations,
     destructive/external actions, prompt-like task content, and confirmation-bypass
     attempts. The gate requires >=80% overall and 100% critical-safety accuracy.
     No provider has been run and no quality result is claimed; a live run requires
     explicit approval if it can spend money or transmit prompts.
6. **Pricing validation and billing — proposed.**
   - Measure costs and willingness to pay; obtain owner approval before any public
   price or payment behavior; implement cancellation and entitlement recovery.

## GitHub issue register

Reconciled 2026-08-28 against the four open repository issues and commit `899c87d`.
External issue comments or closure require owner approval.

| Issue | Evidence-backed disposition | Next action |
|---|---|---|
| #49 — Restore production dependency-PR validation | Runner capacity recovered: hosted lint and image checks pass, while Build reached unit tests and exposed a bash-incompatible recursive glob. The test command is now POSIX-shell portable and CI/runtime use supported Node releases; rerun pending. Ashbi Local CI still fails externally without repository-visible diagnostics. | Verify the next hosted Build; separately restore or diagnose the external Ashbi runner. |
| #29 — Production Compose credentials/health | Implemented on PR #55: required credentials fail closed, PostgreSQL has no host port, configured healthcheck exists, startup migration/reconciliation and app readiness are covered. | Keep open until image + database smoke test passes with Docker. |
| #28 — TODOs/tests/description | Verified fixed: package description exists, 90 tests pass, and source contains no TODO/FIXME markers; enum value `TODO` is application data, not a marker. | Ready for owner-approved evidence comment and closure. |
| #27 — Clickable navigation/calendar divs | Verified fixed: navigation backdrop and calendar days are semantic buttons with accessible names; accessibility contracts pass. | Ready for owner-approved evidence comment and closure. |

## Decision log

- **2026-08-28 — Position on private daily execution, not generic breadth.**
  Evidence: current product shape plus first-party competitor positioning/pricing.
  Alternatives: generic second brain, AI work suite, task manager, team workspace.
  Reversal condition: target-user interviews show a different urgent job and actual
  switching intent. Owner: product owner; state: proposed/researched, not approved.
- **2026-08-31 — Enable only confirmed AI task creation.**
  Evidence: durable tenant-scoped proposals, complete parameter review, single-claim
  confirmation, expiry, reject, and edit-safe undo passed authenticated runtime checks.
  Other mutation executors remain unreachable from chat. Reversal condition: disable
  the slice if representative evaluation or pilot acceptance misses its target.
  State: implemented for task creation; broader actions and evaluation remain pending.

## Risk and blocker register

| Severity | Risk | Mitigation/state | Owner |
|---|---|---|---|
| Critical | No production backup/restore evidence | Local database-plus-upload backup and representative restore drill pass; encrypted off-site schedule, retention, alerts, and production-like RPO/RTO proof remain blocked on owner/operator decisions | Product owner + operator |
| High | Export/deletion lack authenticated runtime and restore-drill evidence | Roadmap item 2 | Engineering |
| High | Onboarding lacks authenticated browser completion evidence | Roadmap item 1 in progress | Engineering/product |
| High | Hosted CI now executes, but the corrected Build has not rerun and external Ashbi Local CI still fails without repository-visible diagnostics | GitHub issue #49; verify next hosted run and diagnose external runner separately | Account owner + engineering |
| High | Five default-branch dependency alerts | Patched versions verified on PR branch; default branch remains exposed until approved merge | Product owner + engineering |
| High | Image/migrations untested together | GitHub issue #29 | Operator |
| High | No legal identity, privacy, or terms | Owner/legal approval required | Product owner |
| Medium | Landing promise needs customer comprehension and conversion evidence | Public copy is implementation-truthful; validate in pilot | Product |
| Medium | Pilot metrics have no real-customer baseline; daily-plan success and external alerts remain absent | Opt-in aggregate activation/engagement/export metrics and local health/error signals verified; obtain pilot consent and operator-owned collection/alerts before relying on targets | Product owner + operator |
| Medium | AI task creation has confirmation/undo and consented decision metrics, but quality, latency, cost, and broader actions remain unmeasured | Keep every other mutation disabled; build and pass the representative evaluation set before expansion | Engineering/product |
| Resolved | Raw browser-push delivery permitted tenant-controlled outbound requests | Unsafe sender removed; in-app notifications remain until standards-compliant Web Push exists | Engineering |
| Resolved | Uploads lacked aggregate tenant/storage quotas | Atomic 512 MB account reservations, migration backfill, and deletion release verified | Engineering |
| Resolved | Interrupted upload/file deletion could retain untracked bytes | Production startup now removes orphan/trash residue and rebuilds quota accounting after migrations | Engineering |
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
- 2026-08-28: production startup now fails closed on database access, reconciles
  untracked upload and private-trash residue, and rebuilds quota accounting from
  authoritative attachment rows before serving traffic. The command passed against
  isolated PostgreSQL; 68 tests, typecheck, zero-warning lint, and production build
  pass.
- 2026-08-28: all five live Dependabot advisories were mapped to exact dependency
  chains and patched in the lockfile. Prisma validation/client generation, 70 tests,
  typecheck, zero-warning lint, production build, full `npm audit`, and
  production-only `npm audit` pass with zero vulnerabilities.
- 2026-08-28: fail-closed database-plus-upload backup and destructive restore-drill
  tooling were added with checksums, archive-path validation, migration validation,
  and upload reconciliation. A disposable PostgreSQL drill restored one attachment,
  its exact 42-byte file, both migrations, and quota accounting; the temporary source
  fixture and restore database were removed. Production scheduling, encrypted
  off-site retention, alert ownership, and RPO/RTO evidence remain release blockers.
- 2026-08-28: cache-disabled liveness and PostgreSQL/upload readiness endpoints,
  image health checks, revision metadata, and privacy-minimal structured startup,
  readiness-failure, and request-error logs were implemented. Runtime verification
  proved `200` liveness, `200` readiness, `503` readiness during a forced database
  outage, and recovery to `200`; 76 tests, typecheck, and zero-warning lint pass.
- 2026-08-28: explicit opt-in product measurement was added for first-plan
  activation, distinct-day Today engagement, and successful export. Only fixed event
  names and local day keys are stored; opt-out deletes prior signals, portable export
  discloses them, and the pilot report emits aggregate counts only. A disposable
  PostgreSQL run verified the third migration, per-day deduplication, activation and
  retention rules, opt-out cleanup, and empty-state output; the synthetic fixture was
  removed. All 81 tests, Prisma validation/generation, typecheck, zero-warning lint,
  and production build pass. No customer baseline is claimed.
- 2026-08-31: AI-proposed task creation gained durable 30-minute review cards,
  complete parameter disclosure, tenant-scoped single-claim confirm/reject decisions,
  and a 10-minute undo that refuses to delete a subsequently edited task. Authenticated
  runtime checks against isolated PostgreSQL proved success, duplicate-confirm denial,
  unchanged-task undo, edited-task preservation, expiry, rejection, and cross-tenant
  denial. Consented aggregate decision reporting and portable export coverage were
  added; no real-user acceptance or quality baseline is claimed.
- 2026-08-31: a provider-neutral 16-case AI task-action evaluation contract and
  deterministic scorer were added with an 80% overall and 100% critical-safety gate.
  Scorer tests prove unsafe critical failures, duplicates, missing cases, and unexpected
  IDs fail closed. No paid/provider execution occurred, so this is evaluation
  infrastructure rather than model-quality evidence.
- 2026-09-01: hosted runners recovered and exposed a real cross-platform CI defect:
  the zsh-expanded recursive test glob was passed literally by GitHub's bash shell.
  Test discovery now uses the repository's flat portable glob, CI runs Node 24 in
  alignment with the production image, and the package declares Node >=22 to satisfy
  dependency engine requirements. All 90 tests, typecheck, and zero-warning lint pass
  locally; the corrected hosted Build rerun remains authoritative evidence.
