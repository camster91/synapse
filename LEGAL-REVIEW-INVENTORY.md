# Synapse RC1 Legal and Data Review Inventory

> **Status:** factual engineering inventory only. This is not legal advice, an approved privacy notice, beta terms, or a compliance representation. Nothing in this file authorizes publication, participant enrollment, external communication, or a licence ownership change.

This document gives the owner and qualified reviewer one place to reconcile what the current Synapse product actually does before issue #62 is closed.

## 1. Owner decisions required before policy or licence changes

Do not replace these with assumptions.

- **Operating identity / contracting party:** OWNER DECISION REQUIRED.
- **Primary jurisdiction / governing location:** OWNER DECISION REQUIRED.
- **Privacy owner and participant-facing privacy contact:** OWNER DECISION REQUIRED.
- **Copyright holder for the repository:** OWNER DECISION REQUIRED.
- **Copyright year or year range:** OWNER DECISION REQUIRED.
- **Managed-beta hosting provider and data region:** OWNER DECISION REQUIRED.
- **Approved transactional-email provider/domain:** OWNER DECISION REQUIRED; pending PR #83 currently implements a Resend adapter but does not configure or approve Resend.
- **Approved support/privacy contact routes:** OWNER DECISION REQUIRED; PR #84 prepares the operating model but does not choose routes.
- **Participant eligibility/minimum-age policy:** OWNER + QUALIFIED REVIEW REQUIRED.
- **Backup retention, deletion-from-backup policy, RPO and RTO:** OWNER DECISION + QUALIFIED REVIEW REQUIRED.
- **Policy/version effective date:** OWNER DECISION REQUIRED after qualified review.

## 2. Current first-party data categories

Current application models and export behaviour show that Synapse can store:

- account profile data such as email, name, avatar URL, timezone, locale, onboarding state and account timestamps;
- credentials-account password hashes and authentication/session data;
- habits and habit logs;
- todos/tasks, priorities, due/scheduled/completed dates and goal relationships;
- goals and progress;
- notes and backlinks;
- journal entries;
- calendar events;
- quick-capture/inbox items;
- tags;
- achievements and XP transactions;
- AI conversations, messages, selected models/providers, tool/action proposals and results;
- attachments and uploaded-file metadata/content;
- notifications and push-subscription records;
- installed plugin/configuration records;
- limited first-party product events when the user has explicitly enabled product analytics;
- encrypted user-supplied Anthropic/OpenAI API keys when configured.

A qualified reviewer should confirm which of these categories need explicit disclosure and whether any category should be excluded or constrained for the managed beta.

## 3. Portable export behaviour

The authenticated portable export currently includes user-owned profile/content records, AI conversations and action proposals, attachments including file content, plugin records, notifications and consented product events.

The export deliberately excludes reusable credentials and secrets, including:

- password hashes;
- Anthropic/OpenAI API key values;
- sessions and authentication tokens;
- push-subscription encryption keys.

The approved privacy notice/terms should describe the export at a user-comprehensible level and must not promise categories the implementation does not actually export.

## 4. Account deletion behaviour

The current authenticated deletion path:

1. requires the literal `DELETE` confirmation;
2. requires password verification for a credentials account;
3. stages the user's uploaded files for deletion;
4. deletes the user database record and schema-cascaded owned records;
5. rolls staged files back if the database delete fails;
6. permanently commits staged file deletion only after the database delete succeeds.

Important policy gap: deleting the live account does **not by itself prove deletion from previously created backups**. Issue #61 deliberately leaves backup retention and restore operations unresolved until the owner approves the backup target/retention model. Privacy/deletion wording must therefore be reconciled with the approved backup-retention procedure before publication.

## 5. Product analytics

Current product analytics are first-party database events, not a third-party web analytics service.

- Events are written only when `productAnalyticsConsent = true` at the time of insertion.
- The current measurement set is intentionally small and fixed by the product-event enum/implementation.
- Turning product analytics consent off deletes that user's previously stored product-event rows in the same settings transaction.
- Measurement failure is designed not to block the user action being measured.

Qualified review should confirm that the final consent wording accurately describes the implemented event set, purpose, retention and opt-out deletion behaviour.

## 6. AI provider data flow

Synapse can use Anthropic, OpenAI, or operator-managed Ollama depending on configuration/user selection.

When a remote provider such as Anthropic or OpenAI is selected, application code sends provider requests containing the chat messages and relevant system/tool context required for the selected AI feature. Tool results can also become provider message context. This means user-entered or application-derived content may leave the Synapse host for the selected remote AI provider.

Current key handling:

- user-supplied Anthropic/OpenAI API keys are encrypted before database persistence when key storage is enabled;
- key values are not returned through the settings API after storage;
- portable export reports only whether a key exists, not its value;
- Ollama may remain local/operator-managed and therefore has a different transfer profile.

Qualified review should define the exact AI disclosure, provider/subprocessor wording, user choice language, and any categories of information users should be warned not to submit.

## 7. Transactional email

Current `main` does not provide the complete external verification/recovery journey required by #60. Pending PR #83 prepares verification and password-recovery email through a configurable Resend REST adapter, but no sender/provider/domain is approved or configured by that PR.

Before policy publication or pilot enrollment, the approved review should reflect the actual provider and sender domain ultimately chosen, not the implementation candidate alone.

## 8. Hosting, uploads and backups

The managed-beta host/data region is not yet approved under #61.

Current operational primitives include:

- PostgreSQL database storage;
- persistent uploaded files;
- a backup containing a PostgreSQL dump plus matching uploaded files;
- checksums and a manifest;
- a destructive restore drill restricted to a disposable database/uploads target.

The repository backup command does not itself encrypt or upload a backup off-site. Those properties depend on the approved operator destination/process. Policy must not claim encrypted off-site backup, retention period, deletion deadline, or geographic location until #61 has real evidence.

## 9. Support and incident records

Issue #63 requires support records to use participant IDs/aggregates instead of private product content. Pending PR #84 prepares that scorecard and incident model, but support routes, responders, hours and participant-facing expectations are still owner decisions.

Qualified review should reconcile support/privacy incident procedures with privacy-contact and withdrawal/deletion wording before pilot enrollment.

## 10. Security-relevant user controls to describe accurately

The product currently has or is preparing the following user/account controls:

- authenticated portable export;
- authenticated account deletion;
- credentials password confirmation for deletion;
- consent-gated first-party product measurement and deletion of those events on opt-out;
- encrypted persistence of supported external AI keys;
- no returning stored AI key values to the browser;
- pending PR #83: verified-email activation, password reset and recovery, with RC1 email identity changes blocked until a separately verified change flow exists.

These are implementation facts, not promises of legal compliance or absolute security.

## 11. Licence ownership blocker

The current MIT `LICENSE` still contains:

`Copyright (c) [year] [fullname]`

Do **not** replace the placeholder until the owner explicitly confirms the correct copyright holder and year/year range. The licence text should then receive the same qualified ownership/release review as the policy package.

## 12. Documents requiring qualified review before publication

At minimum, prepare/review the following only after the owner decisions above are known:

- privacy notice;
- managed-beta terms / participant terms;
- data retention and deletion wording, including backups;
- provider/subprocessor and data-transfer list;
- AI-provider disclosure and user-choice wording;
- product-analytics consent/withdrawal wording;
- participant support, incident and withdrawal instructions;
- any age/eligibility language;
- licence copyright line;
- any public claims about encryption, hosting region, backups, recovery, reliability or deletion timing.

## 13. Publication gate

Issue #62 should remain open until all of the following are true:

1. the owner decisions are explicitly recorded;
2. the final host/provider choices are known;
3. qualified review has approved the actual documents/wording;
4. product copy/onboarding/settings match that approved wording;
5. export/deletion/backup/support/analytics behaviours have been reconciled;
6. the licence ownership placeholder is corrected from an approved owner decision;
7. publication itself receives separate explicit approval.

Until then, this inventory is internal review material only.
