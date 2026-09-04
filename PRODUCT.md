# Synapse Product Control

Authoritative product, positioning, roadmap, risk, evidence, and release record.
Technical implementation detail belongs in `BACKLOG.md`. The governing execution
sequence is GitHub roadmap issue #71. When an older document, issue comment, or PR
body conflicts with this file or #71, the newer evidence-bound record controls.

Last reconciled: 2026-09-04 against `main` baseline
`0c05e7037b5d07029401aad2d6515ef6c243a08c`, roadmap #71, the open issue register,
and the current open PR queue.

## Product charter

- **Product:** Synapse, a web-first, self-hostable personal operating system.
- **Primary customer hypothesis:** privacy-conscious technical solo professionals
  whose goals, tasks, habits, notes, calendar, and reflection are fragmented across
  multiple tools.
- **Core job:** turn intentions and captured inputs into a realistic daily plan,
  preserve context through execution and reflection, and keep the user in control of
  data and AI credentials.
- **Promise hypothesis:** one private daily command center connecting goals to today,
  with portable export, deletion controls, self-hosting, and optional bring-your-own AI.
- **RC1 milestone:** one invite-only, five-user, 14-day managed beta with no billing
  and no public launch.
- **Deliberately deferred:** paid billing, broad acquisition, team collaboration,
  enterprise administration, native mobile apps, broad third-party integrations,
  autonomous AI mutations, and further Adaptive Planning expansion.

## Current release candidate state

The integrated RC1 baseline before this documentation-only reconciliation is:

`0c05e7037b5d07029401aad2d6515ef6c243a08c`

This baseline contains the merged code-side work for:

- verification-gated credential registration and password recovery;
- external transactional-email support through the Resend adapter plus a separate
  loopback-only disposable lifecycle sink;
- production Compose hardening, PostgreSQL migration startup, readiness, backup,
  restore-drill, and authenticated lifecycle tooling;
- privacy-minimal operations preflight/evidence validation;
- beta support/incident definitions and support-metrics tooling;
- legal/data review inventory;
- exact-artifact release package validation;
- canonical migration-aware CI;
- current-main test compatibility fixes;
- image-workflow housekeeping that avoids unnecessary image builds for docs-only
  changes.

This is a **candidate**, not an approved deployment artifact. No immutable release
image digest, managed-beta deployment, public launch, billing activation, participant
outreach, legal publication, or production mutation is authorized by repository state.

## Evidence status

### Implemented or prepared in the repository

- Core authenticated product areas exist: goals, Today/tasks, habits, inbox, notes,
  calendar, journal, export/deletion, plugins, gamification, and AI-assisted flows.
- Production Compose fails closed on required database/authentication secrets,
  PostgreSQL is not host-published, and the app waits for DB health before migration
  and startup.
- `smoke:lifecycle` can create and delete one synthetic disposable account on a
  loopback deployment with explicit confirmation and database cleanup checks.
- Backup creation and destructive restore-drill scripts contain explicit target and
  path guards.
- `ops:preflight` and `ops:evidence` validate approved operations decisions and
  privacy-minimal runtime evidence but do not create that evidence.
- `metrics:support`, pilot metrics, AI-action metrics, economics tooling, and
  `release:validate` exist as decision-support tools.
- Authentication verification/reset tokens are hashed at rest, single-use, and
  time-bounded; password reset invalidates prior credential sessions.

### Still unverified for RC1

The following are not proven merely because supporting code exists:

- exact-candidate Docker/PostgreSQL runtime, lifecycle, backup, and restore proof (#29);
- executable exact-SHA canonical CI plus enforced branch governance (#49);
- external sender/domain DNS alignment, real mailbox delivery, and rendered auth
  journey (#60);
- approved host, encrypted off-site backup, alerts, responders, RPO/RTO, restore,
  rollback, and retention evidence (#61);
- owner legal identity decisions, licence ownership, and qualified policy review (#62);
- approved/verified support routes, responders, hours, escalation, and participant
  instructions (#63);
- complete rendered desktop/mobile/keyboard/failure/recovery/export/reset/delete QA (#64);
- five-user unaided positioning and first-value evidence (#65);
- the 14-day five-user pilot (#66);
- live provider/model AI quality, safety, latency, and cost evidence (#67);
- observed willingness-to-pay and sustainable unit economics (#68);
- exact SHA + immutable image-digest release package and staged-release approval (#70).

### GitHub Actions limitation

GitHub-hosted `CI Build / Build` for the current baseline repeatedly fails before
checkout with zero executed steps. The latest retry also failed before any workflow
step ran. This is not application pass evidence and is not application failure
evidence. Do not describe hosted exact-SHA CI as green until a real job executes.

`main` is currently unprotected. The connected GitHub integration can read ruleset
state but cannot apply repository-administration protection changes. #49 remains open.

## Positioning and market hypothesis

Synapse should not compete as a generic task manager, second brain, or AI automation
suite. The intended wedge is a calmer private daily operating system that connects:

**Goals → Today → Execute → Reflect → Learn**

The differentiation to validate is not feature breadth. It is whether users value a
single daily loop that combines planning context, habits/tasks/calendar/reflection,
portable data, and user-controlled AI.

Customer pain, switching behavior, retention, willingness to pay, and support burden
remain hypotheses until #65/#66/#68 produce measured evidence.

## Packaging and economics hypothesis

The five-user RC1 beta is explicitly **no-payment**.

Internal pricing/economics assumptions may be used only for testing and modeling.
They are not an offer and must not be published automatically. Current modeling
includes a CA$15 monthly / CA$12 annual-equivalent hypothesis, BYOK AI, and a target
contribution margin of at least 75%, but #68 must replace assumptions with observed
hosting, monitoring, backup, support, AI, and customer willingness-to-pay evidence.

Billing implementation is tracked in #69 and is deliberately post-beta.

## RC1 success definition

The managed-beta decision is evidence-driven. The intended thresholds are:

- five approved target participants complete the pilot;
- at least 4 of 5 understand the goals-to-today value without coaching;
- at least 4 of 5 reach a useful first daily plan within ten minutes;
- at least 4 of 5 resolve a daily plan on at least 8 of 14 days;
- at least 4 of 5 cite a concrete planning/execution improvement;
- reliability reaches at least 99.5% with no Sev-1 data-loss/privacy event;
- export/deletion are findable and work for representative pilot accounts;
- support burden is complete, privacy-minimal, and decision-eligible;
- economics remain viable against the approved margin target;
- all trust, recovery, and release gates have exact-artifact evidence.

If thresholds are missed, the result is revise or stop—not automatic feature expansion
or paid launch.

## Governing execution order

Roadmap issue #71 is the authoritative ordered execution plan:

1. **#29** — isolated exact-candidate runtime/lifecycle/backup/restore proof.
2. **#49** — exact-SHA validation execution and enforced PR/review governance.
3. **#61** — host/backup/alerts/responder/RPO/RTO decisions and runtime evidence.
4. **#60** — external email/DNS/mailbox/authentication QA.
5. **#62 + #63** — qualified participant policy and support operations.
6. **#64 + #67** — complete rendered lifecycle and AI-provider validation.
7. **#65 + #68 pre-pilot readiness** — prepare the Day-0 comprehension protocol,
   owner-approved price-test range, question ordering, and economics measurement plan;
   do not require observed pilot economics yet.
8. **#70** — exact SHA/image-digest release package and staged-deployment approval.
9. **#66** — five-user 14-day no-billing pilot; run #65 at Day 0 if not already
   completed and collect willingness-to-pay, support, reliability, and service-cost
   evidence needed by #68.
10. **#68 post-pilot conclusion** — replace assumptions with observed pilot evidence
    and issue an approve/revise/reject economics recommendation before #69 can begin.

Do not bypass an unfinished earlier gate by changing labels or wording.

## Owner decision queue — each approval is separate

This queue prepares decisions; it does not grant permission. Approval for one row
does not authorize any other row, and implementation must still verify the exact
target and artifact immediately before changing external state.

| Decision | Recommended next choice | Evidence required before action | Explicitly not authorized yet |
|---|---|---|---|
| Repository governance | Protect `main`; require pull requests, one qualified approving review, stale-approval dismissal, and `CI Build / Build` once executable | Exact required-check name, real executed exact-SHA validation or an explicitly approved equivalent, and a protected-branch test | Changing rulesets, bypassing checks, or weakening governance |
| Production rehearsal | Use a proven isolated/disposable Docker environment for #29 before any managed-beta host mutation | Exact target identity, isolation proof, disposable DB/volume names, lifecycle/backup/restore plan, and cleanup plan | Provisioning, purchasing, deploying, or accessing production data |
| Legal and data policy | Confirm operating identity, jurisdiction, copyright holder/year, privacy owner, retention/deletion wording, and beta terms with qualified review | Owner-supplied identity and policy decisions appropriate to the selected host and participants | Publishing policy, making compliance claims, or changing licence ownership without approval |
| Support and incidents | Use one primary support route with stated hours and one urgent route for access, loss, deletion, or privacy incidents | Named route owners, coverage hours, escalation destination, backup responder, and pause authority | Contacting users or promising an SLA |
| Managed pilot | Run the consent-first 14-day protocol with exactly five approved target participants after every pre-pilot entry gate is proven | Participant ledger, consent copy, approved host, support routes, lifecycle rehearsal, and exact staged-release approval | Recruiting, contacting, enrolling, or collecting payment |
| Pricing research | Prepare an owner-approved test range before the pilot; collect unaided willingness-to-pay and observed costs during #66, then finalize #68 afterward | Frozen question order/test range before Day 0; five-participant WTP plus measured support/service/AI costs for the post-pilot conclusion | Publishing a price, enabling billing, discounts, or charges |
| Merge and release | Request a separate exact-artifact release approval after governance, host rehearsal, backup/restore, policies, support, and candidate checks are complete | Exact candidate SHA, immutable image digest, complete release package, rollback artifact, and named responder | Merging, tagging, publishing an image, or deploying |

## Post-beta work

### Paid lifecycle

#69 becomes implementation-ready only after #66/#68 produce approved customer and
economics evidence. Provider selection, public pricing, taxes, checkout, billing,
cancellation, refunds, and payment collection are not RC1 entry gates.

### Adaptive Planning

Adaptive Planning remains an approved product direction but is outside RC1. Draft PR
#79 contains implementation for #74, #75, #76, #77, and #80. Those issues are
post-RC1 verification/rebase work, not managed-beta blockers.

The planned next loop is:

**Goals → Today → Execute → Life changes → Adapt → Reflect → Learn → Tomorrow**

Initial slice: **My day changed**, with explainable Keep / Shorten / Move / Drop
proposals and explicit confirmation before mutation.

### Dependency automation

Open dependency PRs #59, #72, and #73 are frozen outside RC1 unless a specific
release-critical security reason is proven. Routine dependency churn must not silently
change the exact candidate during release validation.

## Approval boundaries

Repository preparation and read-only analysis do not authorize external action.
Separate explicit approval is required for any of the following when applicable:

- branch/ruleset administration;
- use of an external Docker/VPS environment;
- deployment or production/database mutation;
- DNS or email-provider configuration;
- purchases or billing changes;
- backup upload, destructive restore, or rollback;
- publishing legal/policy/support wording;
- participant recruitment, outreach, enrolment, interviews, or recording;
- pricing tests with participants;
- payment collection or public launch.

A complete checklist, merged preparation code, or passing validator is never by itself
release authorization.
