import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { findAuthToken } from "@/lib/auth-tokens";

const schema = z.object({ token: z.string().min(20).max(256) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ verified: false, error: "Invalid or expired verification link" }, { status: 400 });
  }

  const token = await findAuthToken("verify", parsed.data.token);
  if (!token) {
    return NextResponse.json({ verified: false, error: "Invalid or expired verification link" }, { status: 400 });
  }

  const deleted = await prisma.verificationToken.deleteMany({
    where: {
      identifier: token.identifier,
      token: token.token,
      expires: { gt: new Date() },
    },
  });

  if (deleted.count !== 1) {
    return NextResponse.json({ verified: false, error: "Invalid or expired verification link" }, { status: 400 });
  }

  return NextResponse.json(
    { verified: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
