import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const AUTH_TOKEN_TTL_MS = 30 * 60 * 1000;

type AuthTokenPurpose = "verify" | "reset";

function identifier(purpose: AuthTokenPurpose, userId: string) {
  return `${purpose}:${userId}`;
}

export function hashAuthToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function createCredentialSessionVersion() {
  return randomBytes(24).toString("base64url");
}

export async function createAuthToken(
  purpose: AuthTokenPurpose,
  userId: string,
  now = new Date(),
) {
  const rawToken = randomBytes(32).toString("base64url");
  const token = hashAuthToken(rawToken);
  const tokenIdentifier = identifier(purpose, userId);
  const expires = new Date(now.getTime() + AUTH_TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.verificationToken.deleteMany({ where: { identifier: tokenIdentifier } });
    await tx.verificationToken.create({
      data: { identifier: tokenIdentifier, token, expires },
    });
  });

  return { rawToken, token, identifier: tokenIdentifier, expires };
}

export async function findAuthToken(
  purpose: AuthTokenPurpose,
  rawToken: string,
  now = new Date(),
) {
  const token = hashAuthToken(rawToken);
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || !record.identifier.startsWith(`${purpose}:`)) return null;
  if (record.expires.getTime() <= now.getTime()) return null;

  const userId = record.identifier.slice(purpose.length + 1);
  if (!userId) return null;
  return { ...record, userId };
}

export async function hasPendingVerification(userId: string) {
  return Boolean(
    await prisma.verificationToken.findFirst({
      where: { identifier: identifier("verify", userId) },
      select: { token: true },
    }),
  );
}

export async function clearAuthTokens(purpose: AuthTokenPurpose, userId: string) {
  await prisma.verificationToken.deleteMany({
    where: { identifier: identifier(purpose, userId) },
  });
}
