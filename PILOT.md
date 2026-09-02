# Synapse managed-beta pilot

This protocol validates Synapse with five target users over 14 days. It is not
authorization to recruit, contact, enroll, charge, deploy, or publish pricing. The
product owner must approve the exact host, support channel, participant list,
consent language, and outreach immediately before the pilot.

## Target participant and job

Recruit people who manage several active goals and repeatedly lose the connection
between those goals and what they should do today. Prefer participants already using
notes, task managers, calendars, or journals but who still reconstruct priorities
manually. Exclude needs involving clinical, emergency, employer-mandated, or
regulated recordkeeping.

The hypothesis is: a private goals-to-today loop helps these users choose and finish
a meaningful daily plan with less tool-switching and planning friction.

## Entry gates

Do not start until all gates have named evidence:

1. exact release SHA, host, rollback artifact, health/readiness checks, backup target,
   successful restore drill, alert destination, and responder;
2. owner-approved privacy/terms and plain-language pilot consent appropriate to the
   selected entity and jurisdiction;
3. one owner-approved support channel and response hours, with a second route for
   urgent account-access or data-loss reports;
4. five consented participants and a participant ID ledger outside product content;
5. lifecycle rehearsal for registration, onboarding, Today, export, and deletion on
   the approved host;
6. no public price and no payment collection unless separately approved.

## Consent and measurement

Explain that this is beta software, what is stored, where it is hosted, how support
works, known limitations, how to export/delete, and how to withdraw. Product
measurement is optional and off by default. If enabled, it stores only the fixed
signals described in Settings. Record consent and withdrawal outside Synapse.

Use participant IDs `P01` through `P05` in the research ledger. Keep only aggregate
product metrics in reports. Never copy task, goal, journal, chat, credential, file
content, interview notes, or identities into application telemetry.

## Day 0 moderated setup (30 minutes)

Without demonstrating the clicks first, ask each participant to:

1. explain what they believe Synapse is for after viewing the landing page;
2. register and create one real outcome, one realistic practice, and one next action;
3. find Today, complete or move the task, log the practice, and close the day;
4. locate data export and account deletion, but do not delete during onboarding;
5. rate setup confidence from 1 to 5 and name the most confusing moment.

Record completion, elapsed time, assistance needed, comprehension language, and
critical friction—never private content. A participant is activated only when their
first daily plan is created within ten minutes without operator data repair.

## Days 1–14

Ask participants to use Today on days when they are actively planning. Send at most
the owner-approved check-ins; silence is not consent to additional outreach.

- Day 2: access/reliability check and one open friction question.
- Day 7: 15-minute midpoint interview plus support-time review.
- Day 14: export rehearsal, outcome interview, willingness-to-pay research, and an
  optional account-deletion rehearsal for anyone who wants to leave.

Log support category, first-response time, resolution time, operator minutes, and
whether the incident blocked the daily loop. Do not log private content. Escalate
suspected cross-account access, credential exposure, unrecoverable loss, or failed
deletion immediately and pause enrollment.

## Interview prompts

Ask for concrete recent behavior before opinions:

1. “Walk me through the last time you decided what mattered today.”
2. “Where did Synapse replace a step, and where did you still use another tool?”
3. “Show me the point where you hesitated or worked around the product.”
4. “What would make you stop using this next week?”
5. “What outcome, if any, was easier to move forward?”
6. “Who would be disappointed if this disappeared, and why?”
7. “What would you expect a managed version to cost?” Test an owner-approved range
   only after the unaided answer; do not offer or collect payment.
8. “What would you need to trust this with another month of planning?”

## Scorecard and decision rules

Run `npm run metrics:pilot` only on the approved pilot database and report aggregates.
Combine it with the research ledger and support/economics worksheet.

| Measure | Proceed threshold | Required response if missed |
|---|---:|---|
| Landing-page job comprehension | 4 of 5 describe goals-to-today value unaided | Repair positioning before acquisition work |
| Activation | 4 of 5 create first daily plan in under 10 minutes | Repair onboarding before adding features |
| Two-week engagement | 4 of 5 resolve a daily plan on at least 8 of 14 days | Diagnose daily-loop value and friction |
| Outcome value | 4 of 5 cite a concrete planning or execution improvement | Revisit target job or segment |
| Reliability | At least 99.5% successful requests; no Sev-1 loss/privacy event | Release blocker; pause if severe |
| Export and control | 5 of 5 locate export/deletion; export succeeds | Release blocker |
| Support load | Median at most 15 operator minutes per active account/week | Update economics and simplify product |
| Commercial signal | At least 3 of 5 accept the approved managed-beta range | Do not publish price; revise offer/economics |

The pilot is decision-ineligible with fewer than five consented participants. Never
average away a critical privacy, security, deletion, or data-loss failure. Re-run
managed-beta economics with measured service/support costs and require at least 75%
contribution margin before requesting paid-launch approval.

## Closeout

Offer every participant an export and deletion path. Revoke pilot access when the
approved window ends unless extension consent is recorded. Reconcile withdrawals,
deletions, backups, incidents, support time, aggregate metrics, and interviews.
Produce a proceed/pivot/stop recommendation that distinguishes evidence from
assumptions. Deployment, outreach, pricing, spending, legal commitments, and public
launch each remain separate approval decisions.
