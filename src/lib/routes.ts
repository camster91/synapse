/** The first authenticated destination, kept separate from the public landing page. */
export function postAuthenticationPath() {
  return "/today";
}

/** New accounts complete one focused setup before entering the full application. */
export function postRegistrationPath() {
  return "/onboarding";
}
