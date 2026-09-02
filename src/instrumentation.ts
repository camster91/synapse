import type { Instrumentation } from "next";

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  console.info(
    JSON.stringify({
      event: "application_started",
      timestamp: new Date().toISOString(),
      revision: process.env.RELEASE_REV || "development",
      runtime: process.env.NEXT_RUNTIME,
    })
  );
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;
  const errorName = error instanceof Error ? error.name : "UnknownError";

  // Do not log request paths, query strings, headers, bodies, error messages, or
  // user identifiers. Those fields can contain private customer data.
  console.error(
    JSON.stringify({
      event: "request_error",
      timestamp: new Date().toISOString(),
      revision: process.env.RELEASE_REV || "development",
      method: request.method,
      route: context.routePath,
      routeType: context.routeType,
      errorName,
      digest,
    })
  );
};
