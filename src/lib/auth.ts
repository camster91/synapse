import NextAuth, { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hasPendingVerification } from "@/lib/auth-tokens";

// Missing accounts still perform a password comparison so credential responses
// do not expose account existence through a cheap timing difference.
const dummyPasswordHash = bcrypt.hash("synapse-invalid-credentials", 12);

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    xp?: number;
    level?: number;
    credentialSession?: boolean;
    credentialVersion?: string | null;
    credentialsInvalidated?: boolean;
  }
}

function invalidateCredentialsToken(token: {
  id?: string;
  credentialsInvalidated?: boolean;
}) {
  token.id = "";
  token.credentialsInvalidated = true;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid email or password");
        }

        const email = credentials.email.trim().toLowerCase();
        const account = await prisma.account.findFirst({
          where: {
            provider: "credentials",
            providerAccountId: { equals: email, mode: "insensitive" },
          },
          include: { user: true },
        });

        const passwordHash = account?.accessToken ?? await dummyPasswordHash;
        const passwordMatch = await bcrypt.compare(credentials.password, passwordHash);
        if (!account?.accessToken || !passwordMatch) {
          throw new Error("Invalid email or password");
        }

        if (await hasPendingVerification(account.user.id)) {
          throw new Error("Email verification required");
        }

        return {
          id: account.user.id,
          email: account.user.email,
          name: account.user.name,
          image: account.user.avatarUrl,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.credentialSession = account?.provider === "credentials";
        token.credentialsInvalidated = false;

        const [dbUser, credentialsAccount] = await Promise.all([
          prisma.user.findUnique({
            where: { id: user.id },
            select: { xp: true, level: true },
          }),
          prisma.account.findFirst({
            where: { userId: user.id, provider: "credentials" },
            select: { refreshToken: true },
          }),
        ]);
        token.xp = dbUser?.xp ?? 0;
        token.level = dbUser?.level ?? 1;
        token.credentialVersion = credentialsAccount?.refreshToken ?? null;
        return token;
      }

      if (token.id && !token.credentialsInvalidated) {
        const credentialsAccount = await prisma.account.findFirst({
          where: { userId: token.id, provider: "credentials" },
          select: { refreshToken: true },
        });

        if (!credentialsAccount) {
          // Do not invalidate a future OAuth-only token. Credential tokens carry
          // either the explicit provider marker or a stored credential version.
          if (token.credentialSession || token.credentialVersion !== undefined) {
            invalidateCredentialsToken(token);
          }
        } else {
          token.credentialSession = true;
          const currentVersion = credentialsAccount.refreshToken ?? null;
          if (token.credentialVersion === undefined) {
            // Legacy JWTs may adopt only the legacy null version. If the account
            // already has a version, a reset or newer login has occurred.
            if (currentVersion === null) {
              token.credentialVersion = null;
            } else {
              invalidateCredentialsToken(token);
            }
          } else if (token.credentialVersion !== currentVersion) {
            invalidateCredentialsToken(token);
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        const invalidated = Boolean(token.credentialsInvalidated || !token.id);
        session.user.id = invalidated ? "" : token.id ?? "";
        if (invalidated) {
          session.user.name = null;
          session.user.email = null;
          session.user.image = null;
        }
        (session as unknown as Record<string, unknown>).xp = invalidated ? 0 : token.xp ?? 0;
        (session as unknown as Record<string, unknown>).level = invalidated ? 0 : token.level ?? 1;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

/** Get the current App Router session. */
export async function auth() {
  return getServerSession(authOptions);
}

export default NextAuth(authOptions);
