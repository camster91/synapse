import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { authTokenIdentifier } from "@/lib/auth-tokens";
import { prisma } from "@/lib/prisma";
import { stageFilesForDeletion } from "@/lib/upload";

const deletionSchema = z.object({
  confirmation: z.literal("DELETE"),
  password: z.string().max(128).optional(),
});

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const userId = session.user.id;

  try {
    const data = deletionSchema.parse(await request.json());
    const account = await prisma.account.findFirst({
      where: { userId, provider: "credentials" },
      select: { accessToken: true },
    });

    if (account?.accessToken) {
      const validPassword = data.password
        ? await bcrypt.compare(data.password, account.accessToken)
        : false;
      if (!validPassword) {
        return NextResponse.json(
          { error: "Password is incorrect" },
          { status: 403, headers: noStoreHeaders },
        );
      }
    }

    const attachments = await prisma.attachment.findMany({
      where: { userId },
      select: { url: true },
    });
    const stagedFiles = await stageFilesForDeletion(attachments.map(({ url }) => url));

    try {
      await prisma.$transaction(async (tx) => {
        // VerificationToken has no User relation because NextAuth owns its
        // schema. Remove Synapse's identifier-scoped rows explicitly so account
        // deletion leaves no verification or password-reset tokens behind.
        await tx.verificationToken.deleteMany({
          where: {
            identifier: {
              in: [
                authTokenIdentifier("verify", userId),
                authTokenIdentifier("reset", userId),
              ],
            },
          },
        });

        // All relation-backed user records are removed through schema cascades.
        await tx.user.delete({ where: { id: userId } });
      });
    } catch (error) {
      await stagedFiles.rollback();
      throw error;
    }

    await stagedFiles.commit();
    return NextResponse.json(
      { deleted: true },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Type DELETE to confirm" },
        { status: 400, headers: noStoreHeaders },
      );
    }
    console.error("account_deletion_failed", { code: "account_deletion_failed" });
    return NextResponse.json(
      { error: "Account deletion failed" },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
