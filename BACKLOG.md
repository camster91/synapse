# Synapse Backlog

Technical implementation record. Product priority, market status, launch claims,
risks, and acceptance criteria are authoritative in `PRODUCT.md`.

Canonical issue ordering reconciled 2026-09-01 against the current PR #55
candidate, the open issue register, local validation, and hosted checks.

## Priority model

- **P0 — Release blocker:** security boundary, unsafe production default, or no trustworthy release gate.
- **P1 — Must fix before beta:** material reliability, privacy, abuse, or data-lifecycle problem.
- **P2 — Beta quality:** accessibility, performance, defense-in-depth, and maintainability work.
- **P3 — Cleanup:** low-risk polish that should not delay higher priorities.

## Ordered backlog

### P0 — Release blockers

1. **Enforce tenant ownership for every relationship ID. — Implemented on PR #55.**
   - Affected inputs: todo `goalId`, todo/note/goal `parentId`, and every `tagIds` input in todo, note, goal, and calendar create/update routes.
   - Risk: an authenticated user can connect another user's record by ID and expose relation metadata or corrupt tenant boundaries.
   - Implemented: shared user-scoped validation now covers all eight create/update routes, rejects foreign/missing relationships, and prevents self/ancestor cycles.
   - Verification: 11/11 tests, typecheck, and lint pass; production build completes with the pre-existing standalone trace-copy warning.

2. **Finish production database hardening (GitHub #29). — Implemented on PR #55; deployment smoke pending.**
   - Implemented: production and VPS Compose fail closed on required credentials and application secrets; the production database host port was removed; the healthcheck uses configured database identity.
   - Verification: 15/15 tests pass; Compose rejects missing settings and accepts a complete non-production validation configuration.
   - Remaining deployment gate: start the built image and database together in an isolated environment and pass health/authenticated smoke tests.

3. **Make pull-request validation authoritative (GitHub #49). — Technical checks restored; governance pending.**
   - Exact-SHA evidence: Build, Lint, Ashbi Local CI, GitGuardian, and the read-only
     dual-architecture image build pass on PR #55.
   - Remaining: confirm required-check/branch-protection enforcement and obtain a
     qualified review of the selected candidate.

### P1 — Must fix before beta

4. **Make the production build hermetic and verify the standalone image. — Image build verified; runtime smoke pending.**
   - Implemented: removed `next/font/google` in favor of a system font stack and removed the duplicate authenticated `/` route by mounting the shared dashboard only at `/today`.
   - Verification: a clean production build succeeds without network font access or the prior standalone manifest-copy warning; 17/17 tests, typecheck, and lint pass.
   - Hosted evidence: the exact candidate builds for `linux/amd64` and `linux/arm64`.
   - Remaining deployment gate: start the image with PostgreSQL and pass health plus authenticated smoke tests.

5. **Add abuse controls to credential authentication. — Implemented locally, awaiting commit/PR.**
   - Implemented: account throttles always cover login and registration; IP throttles activate only with explicit `TRUST_PROXY=true`; forwarded headers are otherwise ignored; buckets are bounded and expire.
   - Enumeration mitigation: registration performs equivalent bcrypt work before the existence branch and returns the same accepted response for an existing account.
   - Verification: budget exhaustion, reset timing, proxy trust, route coverage, and response-contract tests pass as part of the 23/23 suite.

6. **Clean up attachment files when parent entities are deleted. — Implemented locally, awaiting commit/PR.**
   - Implemented: note, todo, calendar, and inbox deletion stage files into a private trash directory before the database cascade, restore them on database failure, and remove them after success.
   - Verification: commit, rollback, and all-parent-route lifecycle coverage pass as part of the 20/20 test suite.

7. **Resolve dependency advisories through the comprehensive upgrade (PR #54). — Upgrade adopted and validated locally.**
   - Implemented: adopted the comprehensive production dependency set and non-breaking audit lockfile fixes; installed resolution currently includes Next.js 16.3.3 and Prisma 7.10.0.
   - Verification: clean install, Prisma generation, 23/23 tests, typecheck, lint, and a clean production build pass.
   - Audit result: reduced from 8 findings to 3 high findings, all in Prisma CLI via `@prisma/config` → `deepmerge-ts`. npm proposes only a breaking downgrade to Prisma 6.12.0, which is not accepted without a separate migration assessment.
   - Tracker action: local work now supersedes PRs #52-#54; close them after this change is committed and proposed as one integrated PR.

### P2 — Beta quality

8. **Fix keyboard-inaccessible click targets (GitHub #27; #26 is an exact duplicate). — Implemented locally.**
   - Implemented: the mobile navigation backdrop and calendar day cells are semantic buttons with accessible names; month controls are explicitly named.
   - Verification: accessibility contract coverage passes as part of the 25/25 suite.
   - Tracker action: close #26 as duplicate and #27 as fixed after the integrated PR merges.

9. **Scope plugin rate limits per user (closed GitHub #7). — Implemented locally.**
   - Implemented: buckets are keyed by user and plugin, expired entries are pruned, and total in-memory state is bounded.
   - Verification: cross-user, cross-plugin, exhaustion, and window-reset coverage pass as part of the 27/27 suite.

10. **Replace habit-streak N+1 queries (closed GitHub #5). — Implemented locally.**
    - Implemented: one history query feeds a timezone-aware, unique-day in-memory streak calculation; invalid saved timezones safely fall back to UTC.
    - Verification: consecutive days, duplicate logs, gaps, timezone boundaries, invalid zones, and the absence of query-per-day loops are covered in the 31/31 suite.

11. **Add explicit HTTP security headers (closed GitHub #8, still applicable). — Implemented locally.**
    - Implemented: CSP, HSTS in production, frame and MIME protections, strict referrer handling, and a restrictive permissions policy apply to every route.
    - The theme bootstrap is a same-origin static script, so `script-src` does not require `unsafe-inline`; development alone permits eval for the framework runtime.
    - Verification: header and theme-policy contracts pass as part of the 40/40 suite; typecheck, zero-warning lint, and the production build pass.

12. **Validate dates and recurrence at the API boundary. — Implemented locally.**
    - Implemented: shared strict ISO date/date-time schemas reject impossible dates and ambiguous timezone-free date-times; recurrence accepts a bounded supported RRULE subset.
    - Applied to todos, goals, calendar events and queries, habit logs, journal entries and queries, and AI tool inputs; ordered ranges enforce end-after-start.
    - Verification: malformed dates, leap days, timezone requirements, recurrence bounds, and ordered ranges pass as part of the 37/37 suite; typecheck and lint pass.

13. **Resolve the journal stale-effect warning and accessibility regressions. — Implemented locally.**
    - Implemented: the journal's date snapshot is stable and its loading effect has complete dependencies; keyboard-inaccessible calendar and mobile navigation targets are semantic buttons.
    - Verification: hook lint and accessibility contract coverage pass.

### P3 — Cleanup

14. **Reduce the 42 lint warnings to zero and fail CI on new warnings. — Implemented locally.**
    - Removed dead imports, state, props, and obsolete lint suppressions; retained documented exceptions for provider-hosted avatar images.
    - `npm run lint` now enforces `--max-warnings=0` so warnings fail local and CI validation.
15. **Add package metadata (`description`) and reconcile README claims with implemented behavior. — Implemented locally.**
    - Added the package description; corrected the NextAuth version, cross-platform setup, dependency-install step, validation commands, plugin scope, and production caveats.

## Tracker reconciliation

| Item | Current disposition | Action |
|---|---|---|
| #49 PR application validation | Open; exact-SHA technical checks pass | Keep for policy enforcement and qualified review; P0 item 3 |
| #29 production Compose | Open, partially stale | Update scope; P0 item 2 |
| #28 TODO/tests/description | Closed completed with exact-SHA evidence on 2026-09-01 | Retain metadata cleanup in P3 item 15 |
| #27 accessibility | Closed completed with exact-SHA evidence on 2026-09-01 | Retain regression coverage in P2 item 8 |
| #26 accessibility | Exact duplicate | Close as duplicate of #27 |
| #10 LLM review umbrella | Closed, stale | Leave closed |
| #9 missing `.env.example` | Closed, fixed | Leave closed |
| #8 missing security headers | Closed `not_planned`, still applicable | Track as P2 item 11 |
| #7 global plugin limiter | Closed `not_planned`, still reproducible | Track as P2 item 9 |
| #6 stored XSS | Closed, fixed | Leave closed; escaping plus DOMPurify is present |
| #5 streak N+1 | Closed `not_planned`, still reproducible | Track as P2 item 10 |
| #4 plaintext AI keys | Closed, fixed | Leave closed; AES-GCM storage and non-secret responses are present |
| #3 old fast-uri advisory | Closed, obsolete | Leave closed; current version is beyond the stated fix |
| #2 old Next.js advisory | Closed, fixed | Leave closed |
| #1 ship/archive decision | Closed, resolved by active development | Leave closed |
| PR #55 integrated hardening | Open, selected candidate | Review after all required evidence; release/merge needs explicit approval |
| PR #56 production dependencies | Open, newer Dependabot proposal | Triage against PR #55 after candidate reconciliation |
| PR #57 development dependencies | Open, newer Dependabot proposal | Triage against PR #55 after candidate reconciliation |

## Verified baseline

- `npm test`: 137/137 passing.
- `npm run typecheck`: passing after `npm run db:generate`.
- `npm run lint`: passing with zero warnings and a zero-warning gate.
- `npm run build`: clean production build passing locally.
- `npm audit`: zero vulnerabilities on the selected candidate.
- Hosted exact-SHA Build, Lint, Ashbi Local CI, GitGuardian, and read-only
  `linux/amd64,linux/arm64` image validation pass.

## Execution order

Complete the remaining runtime smoke and validation-governance gates in items 2-4.
Then triage newer dependency PRs #56-#57 against the selected integrated candidate.
Do not merge or release without explicit approval.
