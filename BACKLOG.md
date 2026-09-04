# Synapse Backlog

Technical implementation and verification record. Product priority, launch claims,
customer validation, and release decisions are authoritative in `PRODUCT.md` and
GitHub roadmap issue #71.

Last reconciled: 2026-09-04 against `main` baseline
`0c05e7037b5d07029401aad2d6515ef6c243a08c`, the open issue register, open PR queue,
and current runtime/CI evidence.

## State model

Use these states consistently:

- **Implemented:** code or documentation exists, but runtime/user evidence may not.
- **Completed awaiting verification:** implementation is present and the remaining
  acceptance evidence is explicit.
- **Blocked / approval-required:** progress depends on owner/admin/external action.
- **Customer-validation pending:** implementation exists but measured user evidence
  does not.
- **Post-beta / Post-RC1:** intentionally excluded from current release gates.
- **Completed and verified:** acceptance evidence exists; close the issue.

Do not use “done,” “green,” or “verified” when only preparation exists.

## Current RC1 baseline

`0c05e7037b5d07029401aad2d6515ef6c243a08c`

Merged into this baseline:

- credentials registration verification and password recovery;
- Resend transactional-email adapter and loopback-only disposable sink;
- production Compose hardening and migration-aware startup;
- health/readiness and authenticated lifecycle smoke tooling;
- backup and destructive restore-drill tooling;
- operations preflight/evidence validation;
- support/incident definitions and support metrics;
- legal/data review inventory;
- exact-artifact release-package validation;
- canonical PostgreSQL-backed CI definition;
- test compatibility fixes;
- image-workflow housekeeping.

This baseline is not an approved deployment artifact.

## P0 — RC1 runtime, trust, and release blockers

### #29 — production-like Compose/runtime proof

**State:** Completed awaiting verification / approval-required.

Implemented:

- production credentials fail closed;
- PostgreSQL is not host-published;
- DB healthcheck uses configured identity;
- app waits for DB health, runs `prisma migrate deploy`, reconciles uploads, and starts;
- lifecycle smoke, backup, and restore-drill tooling have explicit safety guards.

Remaining evidence:

- exact baseline builds/runs in an isolated Docker environment;
- fresh PostgreSQL migrations complete;
- liveness/readiness pass;
- disposable authenticated lifecycle passes;
- backup succeeds;
- restore succeeds into an empty disposable database/uploads target;
- exact-artifact evidence and complete cleanup are recorded.

No production host or existing data may be used without explicit action-time approval.

### #49 — authoritative validation and repository governance

**State:** Blocked / approval-required.

Implemented:

- canonical `CI Build / Build` includes frozen install, Prisma generation,
  disposable PostgreSQL 16, migration deploy, typecheck, zero-warning lint, tests,
  and production build;
- image validation remains path-scoped and non-publishing on PRs;
- workflow-only changes no longer self-trigger unnecessary image publication work.

Current blocker:

- GitHub-hosted jobs repeatedly fail before checkout with zero executed steps;
- latest retry also failed before any step executed;
- `main` is unprotected;
- the connected GitHub integration cannot apply repository-admin rulesets/protection.

Remaining acceptance:

- real exact-SHA validation execution or explicitly approved equivalent evidence;
- required PR workflow/review governance;
- required `CI Build / Build` check;
- stale approval dismissal;
- force-push/deletion protection;
- one test PR proving an unverified change cannot merge.

### #60 — external email and complete authentication QA

**State:** Completed awaiting verification / approval-required.

Implemented:

- generic/enumeration-neutral registration and recovery responses;
- hashed, 30-minute, single-use verification/reset tokens;
- password-reset session invalidation;
- fragment-based bearer links;
- Resend REST adapter with bounded calls and privacy-minimal errors;
- loopback-only local sink for #29 that is explicitly not #60 evidence.

Remaining acceptance:

- approve provider/sender/domain/mailbox/operator/spend;
- SPF/DKIM/DMARC alignment;
- real registration/reset delivery to operator-controlled mailbox;
- replay/expiry proof through delivered messages;
- desktop and 390 px rendered journey;
- delivery-failure observability without account/content disclosure.

### #61 — operations, backup, monitoring, restore, rollback

**State:** Completed awaiting verification / approval-required.

Implemented:

- `ops:preflight` for host/backup/alert/responder/retention/RPO/RTO decisions;
- strict privacy-minimal `ops:evidence` validation;
- backup-age, restore-time, rollback-time, alert-acknowledgement, and retention checks.

Proposed beta defaults only:

- RPO: 24 hours;
- RTO: 4 hours;
- daily encrypted off-site backup;
- 30-day retention unless qualified review changes it;
- alerts for unhealthy instance, error rate, backup failure, and disk >80%;
- named primary and backup responder;
- no public SLA.

Remaining acceptance is real approved-host evidence, not parser tests.

### #62 — legal/data policy and licence ownership

**State:** Blocked / approval-required.

Implemented:

- factual `LEGAL-REVIEW-INVENTORY.md` covering data flows, export/deletion,
  AI providers, authentication email, hosting/backups, support records, analytics,
  and unresolved licence ownership.

Owner decisions still required:

- operating identity/contracting party;
- jurisdiction;
- privacy owner/contact;
- copyright holder/year;
- host/data region;
- email provider/domain;
- support/privacy routes;
- participant eligibility;
- retention/RPO/RTO;
- policy effective date.

Qualified review and separate publication approval remain mandatory.

### #63 — beta support and incident operations

**State:** Completed awaiting verification / approval-required.

Implemented:

- Sev 1/2/3 definitions and stop rules;
- privacy-minimal support ledger/scorecard;
- P01–P05 participant IDs only;
- decision-ineligible incomplete-week handling;
- no-SLA boundary.

Remaining acceptance:

- approve primary/urgent routes;
- primary and backup responders;
- coverage hours/time zone;
- escalation and pause authority;
- operational route test;
- qualified-review-approved participant support/withdrawal wording.

### #70 — exact-artifact pre-pilot release package

**State:** Completed awaiting evidence / approval-required.

Implemented:

- exact SHA and immutable digest fields;
- fail-closed release gates;
- exact-artifact approval binding;
- `release:validate` completeness mode and approval-required mode;
- staged rollout and rollback boundaries.

Pre-pilot acceptance requires:

- real runtime/trust evidence from #29/#49/#60/#61/#62/#63/#64/#67;
- #65 Day-0 comprehension protocol ready, with any completed pre-pilot evidence
  included; if not completed beforehand, it must be explicitly incorporated into
  #66 Day 0;
- #68 **pre-pilot readiness only**: an owner-approved test range, frozen unaided-WTP
  question order, and economics measurement plan. Observed WTP/support/service-cost
  results are collected during #66 and are not prerequisites for #70;
- exact immutable image digest;
- migration boundary;
- release notes/known limitations/responders/rollback triggers;
- one explicit `approve / reject / request-changes` request bound to the exact
  pre-pilot artifact.

#66 is not a dependency of #70. #70 is the release package that must be approved
before #66 can start on the managed-beta host.

## P1 — RC1 validation gates

### #64 — rendered customer lifecycle QA

**State:** Customer-validation/runtime QA pending.

After #29 and #60, verify the complete rendered journey on an approved disposable
host: registration, mailbox verification, onboarding, Today loop, export, password
recovery/session invalidation, and account deletion across desktop, 390 px mobile,
keyboard, focus, slow/failure/retry, expiry, and duplicate-submit states.

### #65 — goals-to-today comprehension and first value

**State:** Customer-validation pending.

Five approved target participants must describe the value unaided and reach a useful
first daily plan. Identities/private content stay outside GitHub; use P01–P05 evidence.
Participant recruitment/contact requires separate approval. The Day-0 test may occur
immediately before the 14-day pilot or as the explicit first phase of #66; it does not
need to be falsely completed before the pilot environment exists.

### #66 — five-user 14-day managed beta

**State:** Customer-validation pending / approval-required.

Do not start until the runtime/trust/policy/support/pre-pilot release gates are
satisfied, including #70 exact-artifact staged-deployment approval. The pilot is
invite-only, five approved testers, 14 measured days, no billing, and privacy-minimal
evidence. Any Sev 1 trust incident pauses enrolment/use.

During #66, collect the evidence needed to complete #65 and #68 when those tests are
incorporated into Day 0 / pilot closeout.

### #67 — AI task-creation quality/safety/latency/cost

**State:** Validation pending / approval-required.

The provider-neutral evaluation contract exists. No live managed-beta provider/model
result is claimed. External provider/model calls, spend, or prompt transmission require
explicit approval. Critical-safety accuracy must be 100% or the feature remains
limited/disabled.

### #68 — pricing and sustainable economics

**State:** Pre-pilot plan readiness + post-pilot customer/economics validation pending /
approval-required.

Before #70/#66:

- freeze the unaided willingness-to-pay questions and order;
- obtain explicit approval for any price range that will be shown after the unaided
  response;
- define the service/support/AI cost fields to measure during the pilot;
- do not publish pricing or collect payment.

During #65/#66:

- collect unaided willingness-to-pay before showing the approved range;
- collect observed service/support/AI cost evidence using privacy-minimal records.

After #66:

- replace modeled assumptions with observed evidence;
- run sensitivity analysis against the approved contribution-margin target;
- recommend approve/revise/reject;
- only then may #69 become implementation-ready if separately approved.

## Post-beta

### #69 — billing, cancellation, entitlement recovery

**State:** Post-beta.

Not an RC1 entry gate. Becomes implementation-ready only after #66/#68 produce
approved customer/economics evidence. Provider selection, taxes, checkout, webhooks,
refunds, cancellation, and payment collection remain separate approvals.

## Post-RC1 — Adaptive Planning

Draft PR #79 contains the implementation candidate and remains intentionally outside
RC1. These issues are implemented on the deferred branch but not rebased/verified:

- #74 — parent `My day changed` vertical slice;
- #75 — deterministic prioritization/capacity model;
- #76 — preview/revalidate/confirm/apply/safe-undo lifecycle;
- #77 — mobile-first rendered interaction;
- #80 — effort/deferral/persistence/migration/undo model.

Before any later merge: rebase on post-beta `main`, run full exact-head validation,
verify migration/apply/undo against disposable PostgreSQL, and complete rendered QA.

## Dependency queue

Open bot PRs currently frozen outside RC1:

- #59 — production dependency group;
- #72 — `docker/login-action` v4;
- #73 — development dependency update.

Do not merge routine dependency churn into the frozen candidate unless a specific
release-critical security reason is demonstrated and the candidate is deliberately
re-frozen/revalidated.

## Execution order

1. #29 isolated runtime proof.
2. #49 exact-SHA validation + governance.
3. #61 operations decisions/evidence.
4. #60 external email/DNS/auth QA.
5. #62 + #63 policy/support decisions and verification.
6. #64 + #67 rendered lifecycle and AI validation.
7. #65 Day-0 protocol + #68 pre-pilot test-range/economics measurement readiness.
8. #70 exact-artifact pre-pilot release package and staged deployment approval.
9. #66 five-user 14-day pilot; run #65 Day 0 if needed and collect #68 WTP/cost data.
10. #68 final post-pilot economics recommendation.

No later phase should silently bypass an unfinished earlier gate.

## Release boundary

Do not merge/release/deploy, alter production, configure DNS/providers, publish legal
or support wording, contact participants, change billing, or collect payment without
the corresponding explicit approval. Repository preparation does not authorize the
external action.
