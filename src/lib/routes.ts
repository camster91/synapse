/** The first authenticated destination, kept separate from the public landing page. */
export function postAuthenticationPath() {
  return "/today";
}

const authenticatedPathPrefixes = [
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

/** Preserve an authenticated deep link without accepting an external or auth-loop redirect. */
export function safePostAuthenticationPath(callbackUrl: string | null, currentOrigin: string) {
  if (!callbackUrl) return postAuthenticationPath();

  try {
    const destination = new URL(callbackUrl, currentOrigin);
    if (destination.origin !== currentOrigin) return postAuthenticationPath();
    if (!authenticatedPathPrefixes.some((prefix) =>
      destination.pathname === prefix || destination.pathname.startsWith(`${prefix}/`)
    )) {
      return postAuthenticationPath();
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return postAuthenticationPath();
  }
}

/** New accounts complete one focused setup before entering the full application. */
export function postRegistrationPath() {
  return "/onboarding";
}
