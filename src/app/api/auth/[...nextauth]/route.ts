import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { consumeRateLimit, rateLimitResponse, trustedClientIp } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

export const GET = handler;

export async function POST(request: Request, context: unknown) {
  const isCredentialCallback = new URL(request.url).pathname.endsWith(
    "/api/auth/callback/credentials"
  );

  if (isCredentialCallback) {
    const form = await request.clone().formData();
    const email = form.get("email");
    if (typeof email === "string" && email.trim()) {
      const accountLimit = consumeRateLimit({
        namespace: "login-account",
        identifier: email,
        maxAttempts: 10,
        windowMs: 15 * 60 * 1000,
      });
      if (!accountLimit.allowed) return rateLimitResponse(accountLimit.retryAfterSeconds);
    }

    const clientIp = trustedClientIp(request);
    if (clientIp) {
      const ipLimit = consumeRateLimit({
        namespace: "login-ip",
        identifier: clientIp,
        maxAttempts: 30,
        windowMs: 15 * 60 * 1000,
      });
      if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);
    }
  }

  return handler(request, context as never);
}
