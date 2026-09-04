# Synapse managed-beta support and incident model

This document prepares the operating model for the five-user managed beta. It does
not authorize participant outreach, publish support promises, or establish an SLA.
Anything marked **OWNER DECISION REQUIRED** must be explicitly approved before pilot
enrolment or external communication.

## Owner decision queue

The following values intentionally remain unset:

- Primary support route: **OWNER DECISION REQUIRED**
- Urgent access/data-loss/deletion/privacy route: **OWNER DECISION REQUIRED**
- Primary responder: **OWNER DECISION REQUIRED**
- Backup responder: **OWNER DECISION REQUIRED**
- Response hours/time zone: **OWNER DECISION REQUIRED**
- Escalation destination: **OWNER DECISION REQUIRED**
- Pilot pause authority: **OWNER DECISION REQUIRED**
- Known coverage gaps: **OWNER DECISION REQUIRED**

No response-time or resolution-time SLA is promised. The beta may communicate
support hours and best-effort expectations only after those statements are approved.

## Privacy boundary for support records

Use participant IDs `P01` through `P05`. Support records and scorecards must never
contain names, email addresses, task/goal/journal/chat/file contents, credentials,
raw tokens, interview notes, or copied product content.

The machine-readable support ledger is deliberately constrained to:

- participant ID;
- measured week;
- fixed category;
- severity;
- first-response minutes;
- resolution minutes when resolved;
- operator minutes;
- whether the daily loop was blocked;
- resolved/unresolved state.

If context is needed to diagnose a defect, keep it in the minimum-access engineering
incident record appropriate to that incident; do not copy it into pilot research or
support-metrics files.

## Severity and stop rules

### Sev 1 — immediate pilot stop

Treat any of the following as Sev 1:

- suspected or confirmed cross-account access;
- credential, secret, or authentication-token exposure;
- unrecoverable user-data loss;
- account deletion that reports success but fails to delete required data;
- a privacy incident involving another participant's data;
- a security defect that could reasonably expose stored private content.

Required internal response: stop new enrolment, preserve privacy-minimal evidence,
prevent further exposure where safely possible, escalate to the approved responder,
and do not resume the pilot until the incident is understood and an accountable owner
approves resumption.

### Sev 2 — core journey blocked, no known exposure/loss

Examples include inability to sign in, repeated failure of Today/onboarding/export,
a recoverable account-access issue, or a defect that prevents the participant's core
daily loop. Escalate through the approved support route. Pause the affected account's
pilot activity when continued use could make recovery harder.

### Sev 3 — ordinary defect or usability friction

Examples include non-blocking UI defects, confusing copy, minor visual issues, or a
workaround that does not threaten data integrity, privacy, account access, or the core
daily loop.

Severity must be raised whenever new evidence warrants it. Never lower severity merely
to protect pilot metrics.

## Support scorecard

Run:

```bash
npm run metrics:support -- /absolute/path/to/privacy-minimal-support-ledger.json
```

Example ledger structure:

```json
{
  "schemaVersion": 1,
  "participants": ["P01", "P02", "P03", "P04", "P05"],
  "weeks": ["2026-09-07"],
  "records": [
    {
      "participantId": "P01",
      "weekKey": "2026-09-07",
      "category": "access",
      "severity": "sev2",
      "firstResponseMinutes": 30,
      "resolutionMinutes": 45,
      "operatorMinutes": 12,
      "blockedDailyLoop": true,
      "resolved": true
    }
  ]
}
```

The script rejects unknown fields so free-text/private content cannot silently enter
the scorecard. It includes participant/week combinations with zero support time when
calculating the median operator load.

The pilot support-load threshold is a median of at most **15 operator minutes per
active account per measured week**. A result is decision-ineligible unless all five
participant IDs are present and at least one week is defined. Any Sev 1 incident sets
`pauseEnrollment: true` regardless of aggregate metrics.

## Participant-facing expectations

Before enrolment, separately approve plain-language wording that states:

- Synapse is beta software and may contain defects;
- which support route to use for ordinary help;
- which urgent route to use for access, loss, deletion, or privacy concerns;
- the actual staffed response hours and known coverage gaps;
- how to export/delete data and withdraw from the pilot;
- that no unsupported SLA is being promised.

Do not send or publish this wording until the routes, owners, hours, escalation path,
and withdrawal process are explicitly approved.
