import { prisma } from "@/lib/prisma";

export const MAX_USER_UPLOAD_BYTES = BigInt(512 * 1024 * 1024);

export async function reserveUploadCapacity(
  userId: string,
  sizeBytes: number
): Promise<boolean> {
  const requestedBytes = BigInt(sizeBytes);
  if (requestedBytes < BigInt(0) || requestedBytes > MAX_USER_UPLOAD_BYTES) return false;

  const result = await prisma.user.updateMany({
    where: {
      id: userId,
      uploadBytes: { lte: MAX_USER_UPLOAD_BYTES - requestedBytes },
    },
    data: { uploadBytes: { increment: requestedBytes } },
  });

  return result.count === 1;
}

export async function releaseUploadCapacity(
  userId: string,
  sizeBytes: number | bigint
): Promise<void> {
  const releasedBytes = BigInt(sizeBytes);
  if (releasedBytes <= BigInt(0)) return;

  await prisma.$executeRaw`
    UPDATE "users"
    SET "uploadBytes" = GREATEST("uploadBytes" - ${releasedBytes}, 0)
    WHERE id = ${userId}
  `;
}
