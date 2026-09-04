# Synapse RC1 Release Approval Flow

This file defines how to assemble an approval package. It does not authorize a merge, tag, image publication, deployment, pricing change, outreach, billing, or public launch.

## Principle

A release decision applies only to one exact commit SHA and one immutable image digest. A green checklist without explicit artifact-bound approval is not deployment authorization.

## 1. Freeze the candidate

After all release-blocker PRs are approved and merged, select one candidate commit. Stop routine feature/dependency changes while it is being validated.

Record:

- full 40-character commit SHA;
- immutable image `sha256:` digest;
- exact Prisma migration boundary.

Copy `release/rc1-release-package.example.json` into a private release-evidence location and replace placeholders only with real evidence.

## 2. Complete validation evidence

Every boolean under `validation`, `runtime`, `trust`, and `release` must be supported by exact-candidate evidence. Do not mark a gate true because similar code passed earlier or because a workflow was queued.

Important examples:

- a GitHub Actions job that failed before executing steps is not a failed application check, but it is also not a passing release check;
- local/disposable lifecycle email bypass is not external-email proof;
- documentation/preflight is not backup, alert, restore, or rollback runtime evidence;
- an internal legal inventory is not qualified legal/policy approval;
- an open/mergeable PR is not a qualified approving review.

## 3. Validate package completeness

Run:

```bash
npm run release:validate -- /absolute/path/to/rc1-release-package.json
```

This validates package completeness but intentionally returns `approvedForMutation: false`.

## 4. Present the explicit approval request

The request must state:

- exact action proposed;
- customer/tester impact;
- explicit CAD cost, including `$0` when there is no incremental spend;
- material risks;
- exact rollback approach;
- choices: `approve`, `reject`, or `request-changes`.

For the currently intended milestone, the action should remain narrow: an invite-only, no-billing managed beta for five approved testers. Public launch, billing, pricing, outreach beyond approved testers, or broader infrastructure changes are separate actions.

## 5. Bind approval to the artifact

Only after explicit owner approval, copy the exact candidate SHA and image digest into `approval.approvedArtifactCommitSha` and `approval.approvedArtifactImageDigest`, set `approval.approved=true`, then run:

```bash
npm run release:validate -- /absolute/path/to/rc1-release-package.json --require-approval
```

The validator rejects approval if either approved artifact identity differs from the candidate.

## 6. Staged rollout

Even with a valid approval package:

1. perform only the exact approved mutation;
2. verify readiness immediately;
3. perform the documented post-release verification;
4. stop/pause on any pre-defined rollback trigger;
5. rollback to the approved previous immutable artifact if required;
6. do not broaden the rollout without a new approval.

## 7. RC1 remains blocked until evidence exists

Issue #70 remains open until dependencies such as #29, #49, #60, #61, #62 and #63 are actually satisfied, not merely prepared. The example package must never be treated as release evidence.
