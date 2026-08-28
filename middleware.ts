export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/onboarding/:path*",
    "/today/:path*",
    "/achievements/:path*",
    "/calendar/:path*",
    "/chat/:path*",
    "/goals/:path*",
    "/habits/:path*",
    "/inbox/:path*",
    "/journal/:path*",
    "/notes/:path*",
    "/plugins/:path*",
    "/settings/:path*",
    "/todos/:path*",
  ],
};
