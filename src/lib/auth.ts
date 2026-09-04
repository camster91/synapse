import NextAuth, { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hasPendingVerification } from "@/lib/auth-tokens";

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
    credentialVersion?: string | null;
    credentialsInvalidated?: boolean;
  }
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
          throw new Error("Email and password are required");
        }

        const email = credentials.email.trim().toLowerCase();
        const account = await prisma.account.findFirst({
          where: {
            provider: "credentials",
            providerAccountId: email,
          },
          include: { user: true },
        });

        if (!account || !account.accessToken) {
          throw new Error("Invalid email or password");
        }

        const passwordMatch = await bcrypt.compare(credentials.password, account.accessToken);
        if (!passwordMatch) {
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
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

        if (credentialsAccount) {
          const currentVersion = credentialsAccount.refreshToken ?? null;
          if (token.credentialVersion === undefined) {
            // Backward-compatible adoption for sessions issued before versioning.
            token.credentialVersion = currentVersion;
          } else if (token.credentialVersion !== currentVersion) {
            token.id = "";
            token.credentialsInvalidated = true;
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.credentialsInvalidated ? "" : token.id ?? "";
        (session as unknown as Record<string, unknown>).xp = token.xp ?? 0;
        (session as unknown as Record<string, unknown>).level = token.level ?? 1;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

/**
 * Get the current session on the server side (App Router).
 * Use this in server components and API routes.
 */
export async function auth() {
  return getServerSession(authOptions);
}

export default NextAuth(authOptions);
