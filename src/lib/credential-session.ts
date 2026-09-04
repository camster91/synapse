export interface CredentialSessionClaims {
  credentialSession?: boolean;
  credentialVersion?: string | null;
}

export type CredentialSessionDecision =
  | { kind: "not_credentials" }
  | { kind: "valid" }
  | { kind: "adopt_legacy_null"; credentialVersion: null }
  | { kind: "invalid" };

/**
 * Reconcile a JWT's credential-session claims with the current credentials
 * account version. `accountVersion === undefined` means no credentials account;
 * `null` means a legacy account that has not yet received a random version.
 */
export function reconcileCredentialSession(
  claims: CredentialSessionClaims,
  accountVersion: string | null | undefined,
): CredentialSessionDecision {
  if (claims.credentialSession === false) {
    return { kind: "not_credentials" };
  }

  const legacyUnmarked =
    claims.credentialSession === undefined &&
    claims.credentialVersion === undefined;
  const credentialLike =
    legacyUnmarked ||
    claims.credentialSession === true ||
    claims.credentialVersion !== undefined;

  if (!credentialLike) return { kind: "not_credentials" };
  if (accountVersion === undefined) return { kind: "invalid" };

  if (legacyUnmarked) {
    // Before versioning Synapse offered only credentials login. An unmarked JWT
    // may adopt only the legacy null version. A populated version proves that a
    // reset or newer login has occurred, so the unmarked token must be rejected.
    return accountVersion === null
      ? { kind: "adopt_legacy_null", credentialVersion: null }
      : { kind: "invalid" };
  }

  if (claims.credentialVersion === undefined) return { kind: "invalid" };
  return claims.credentialVersion === accountVersion
    ? { kind: "valid" }
    : { kind: "invalid" };
}
