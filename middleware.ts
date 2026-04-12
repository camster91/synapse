export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/auth (NextAuth routes)
     * - /login, /register (auth pages)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, public assets
     */
    "/((?!api/auth|login|register|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};