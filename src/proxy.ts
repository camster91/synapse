import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPrefixes = [
  "/onboarding",
  "/today",
  "/achievements",
  "/calendar",
  "/chat",
  "/goals",
  "/habits",
  "/inbox",
  "/journal",
  "/notes",
  "/plugins",
  "/settings",
  "/todos",
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function contentSecurityPolicy(nonce: string) {
  const developmentScriptPolicy = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
  const productionUpgrade = process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentScriptPolicy}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
  ].join("; ") + productionUpgrade;
}

export default withAuth(
  function middleware(request: NextRequest) {
    const nonce = btoa(crypto.randomUUID());
    const policy = contentSecurityPolicy(nonce);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", policy);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", policy);
    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (!isProtectedPath(req.nextUrl.pathname)) return true;
        return Boolean(token?.id && !token.credentialsInvalidated);
      },
    },
  },
);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|theme-init.js|manifest.json|sw.js).*)"],
};
