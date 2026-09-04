## Purpose

Describe the bounded change and the current product/backlog authority it serves.

## Scope

- In scope:
- Out of scope:
- Product/release source:
- Data/auth/AI/operations boundaries affected:

## Exact-head verification

Record only checks that actually ran against this head or exact artifact. Do not treat queued, unavailable, superseded, or infrastructure-failed checks as passed.

- [ ] Locked install / environment established
- [ ] Prisma generated when applicable
- [ ] Committed migrations proven against disposable PostgreSQL when applicable
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Applicable lifecycle/operations/release validator
- [ ] Exact-head CI status inspected

Evidence/results:

## Web / accessibility QA

When UI is affected:

- [ ] Mobile (~390 px)
- [ ] Tablet (~768 px)
- [ ] Desktop (~1440 px)
- [ ] Keyboard/focus/accessibility basics
- [ ] Forms/validation/loading/error/empty states
- [ ] Auth/deep-link flow where applicable
- [ ] Browser console/regression check

Rendered evidence obtained:

## Security, privacy, and data integrity

- [ ] Tenant isolation and ownership remain intact.
- [ ] No real user data, credentials, bearer tokens, auth links, provider secrets, or production connection strings were added to code/evidence.
- [ ] Auth/reset/verification/session boundaries remain fail-closed where applicable.
- [ ] AI provider/key boundaries remain user-scoped; autonomous mutations were not enabled without the required approval/confirmation contract.
- [ ] Database changes use committed migrations and were not proven against shared/production data.
- [ ] Backup/export/delete/retention implications were reviewed when applicable.
- [ ] Required tests/security/CI gates were not weakened merely to obtain green status.

## Deployment / operations boundary

Production or shared environment changed: **No unless separately and explicitly approved.**

- Deployment impact:
- Migration impact:
- Backup/restore impact:
- Rollback evidence:
- External email/hosting/monitoring/legal/customer dependencies:

Do not infer production readiness from a successful source build or image alone.

## Handoff

Use the repository status model:

1. Completed and verified
2. Completed but awaiting verification
3. In progress
4. Blocked
5. Awaiting client or teammate
6. Next action

Remaining risks/blockers:

Next action / approval gate:
