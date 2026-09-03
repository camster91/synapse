import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;

export interface AdaptiveConfirmationClaims {
  v: number;
  userId: string;
  proposalId: string;
  snapshotHash: string;
  expiresAt: string;
}

function secret() {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("NEXTAUTH_SECRET is required to sign adaptive planning confirmations");
  return value;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signAdaptiveConfirmation(input: Omit<AdaptiveConfirmationClaims, "v">) {
  const claims: AdaptiveConfirmationClaims = { v: TOKEN_VERSION, ...input };
  const payload = encode(JSON.stringify(claims));
  return `${payload}.${signature(payload)}`;
}

export function verifyAdaptiveConfirmation(token: string, expectedUserId: string, now = new Date()) {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;

  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const claims = JSON.parse(decode(payload)) as AdaptiveConfirmationClaims;
    if (claims.v !== TOKEN_VERSION || claims.userId !== expectedUserId) return null;
    const expiresAt = new Date(claims.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) return null;
    return claims;
  } catch {
    return null;
  }
}
