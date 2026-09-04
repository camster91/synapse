# Synapse RC1 Operations Evidence Addendum

This addendum supplements `OPERATIONS.md`. It prepares release evidence; it is not evidence of a production deployment and does not authorize provisioning, purchases, secret changes, deployment, or destructive operations.

## Decision preflight

Before provisioning or release approval, copy `.env.operations.example` into an operator-only environment source and fill it only after the corresponding decisions are approved. It contains identifiers and targets, not credentials.

The preflight requires:

- exact managed host URL;
- approved off-site backup destination identifier;
- explicit confirmation that the backup target is off-site and encrypted;
- alert-destination identifier and named responder identifier;
- approved retention, RPO, and RTO values.

Run:

```bash
npm run ops:preflight
```

A pass means only that accountable decisions have been supplied. It always reports `operationalEvidenceVerified: false`; it does not claim that backups, alerts, restores, or rollback have actually run.

The command redacts host, backup destination, alert route, and responder from its JSON output so the preflight result can be attached to a release review without publishing infrastructure details.

## Exact-artifact evidence

Use `ops/operations-evidence.example.json` as the structure for the final RC1 operations record. Replace every placeholder only with evidence from the exact release candidate.

The record binds evidence to:

- a full 40-character commit SHA;
- an immutable `sha256:` image digest;
- the exact migration boundary;
- readiness, backup, restore-drill, and rollback timestamps;
- measured restore elapsed time;
- delivered tests for backup failure, unhealthy instance, error-rate, and disk alerts;
- proof that rollback returned the environment to healthy readiness.

Validate the completed record with:

```bash
npm run ops:evidence -- /absolute/path/to/operations-evidence.json
```

The validator fails closed on placeholder artifact identifiers, any missing alert class, incomplete restore/rollback proof, or evidence marked as containing credentials, customer content, or customer identifiers.

A passing record is still only one release gate. Owner approval of the host, backup destination, alert destination, responder, retention, RPO, RTO, and any spend remains required under issue #61.

## Operator sequence after approval

1. Run `npm run ops:preflight` from the approved operator environment.
2. Build/fetch the exact approved candidate and record its commit SHA and immutable image digest.
3. Verify readiness on the approved non-production/managed-beta host.
4. Run `npm run backup` to the approved private staging location and copy/encrypt it to the approved off-site target using the approved operator procedure.
5. Trigger and verify the four required alert classes without including customer content in evidence.
6. Run the destructive restore drill only against a newly created disposable database/uploads target.
7. Measure restore time and verify representative database/upload integrity.
8. Rehearse rollback to the approved previous artifact and verify healthy readiness.
9. Complete the exact-artifact JSON evidence record and run `npm run ops:evidence`.
10. Keep #61 open unless every acceptance criterion has real runtime evidence.
