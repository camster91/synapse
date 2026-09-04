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
- **Approved transactional-email provider/domain:** OWNER DECISION REQUIRED. The code-side verification/recovery journey is now on `main`, but no sender/provider/domain is approved or externally verified.
- **Approved support/privacy contact routes:** OWNER DECISION REQUIRED. The support/incident model is now on `main`, but routes, responders, hours and escalation remain unset.
- **Participant eligibility/minimum-age policy:** OWNER + QUALIFIED REVIEW REQUIRED.
- **Backup retention, deletion-from-backup policy, RPO and RTO:** OWNER DECISION + QUALIFIED REVIEW REQUIRED. The operations validators are now on `main`, but they do not constitute runtime evidence.
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
4. removes relationless verification/reset token rows for that account;
5. deletes the user database record and schema-cascaded owned records;
6. rolls staged files back if the database delete fails;
7. permanently commits staged file deletion only after the database delete succeeds.

Important policy gap: deleting the live account does **not by itself prove deletion from previously created backups**. Issue #61 still requires approved backup retention and real restore/rollback evidence. Privacy/deletion wording must therefore be reconciled with the approved backup-retention procedure before publication.

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

## 7. Transactional email and credentials recovery

The code-side credentials journey is now on `main` and includes:

- verification-gated credentials registration;
- generic public responses for registration, resend and password recovery;
- hashed 30-minute single-use verification/reset tokens;
- verification and password-reset screens;
- reset-session invalidation;
- RC1 email identity remaining read-only until a separately verified email-change flow exists;
- configurable Resend delivery plus a tightly restricted loopback-only disposable local sink for runtime smoke.

This does **not** prove the external #60 gate. No sender/provider/domain/mailbox is approved or configured by the merge itself, and SPF/DKIM/DMARC, real mailbox delivery, expiry/replay through real messages, rendered host QA and delivery-failure evidence remain outstanding.

Before policy publication or pilot enrollment, the approved review should reflect the actual provider and sender domain ultimately chosen, not only the implementation capability.

## 8. Hosting, uploads, backups and recovery

The managed-beta host/data region is not yet approved under #61.

Current operational primitives include:

- PostgreSQL database storage;
- persistent uploaded files;
- a backup containing a PostgreSQL dump plus matching uploaded files;
- checksums and a manifest;
- a destructive restore drill restricted to a disposable database/uploads target;
- decision-safe operations preflight for approved host, backup, alert, retention, RPO and RTO values;
- exact-candidate evidence validation for readiness, backup, restore, rollback and alert proof.

The repository backup command does not itself encrypt or upload a backup off-site. The operations validators inspect declared decisions/evidence; they do not create runtime proof. Policy must not claim encrypted off-site backup, retention period, deletion deadline, geographic location, RPO/RTO achievement, or tested alerting until #61 has real evidence.

## 9. Support and incident records

The support/incident model is now on `main` and requires support records to use participant IDs/aggregates instead of private product content. The scorecard includes fixed severity/category contracts, zero-support participant/weeks, operator minutes, completion eligibility and automatic pilot pause on any Sev 1.

Support routes, responders, hours, escalation destination, pause authority and participant-facing expectations remain owner decisions. Qualified review should reconcile support/privacy incident procedures with privacy-contact and withdrawal/deletion wording before pilot enrollment.

## 10. Security-relevant user controls to describe accurately

The product currently has or is preparing the following user/account controls:

- authenticated portable export;
- authenticated account deletion;
- credentials password confirmation for deletion;
- consent-gated first-party product measurement and deletion of those events on opt-out;
- encrypted persistence of supported external AI keys;
- no returning stored AI key values to the browser;
- verified-email activation and password recovery for credentials accounts;
- server-side invalidation of older credential sessions after password reset;
- RC1 email identity changes blocked until a separately verified change flow exists.

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
