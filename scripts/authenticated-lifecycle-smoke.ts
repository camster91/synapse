import { randomBytes } from "node:crypto";
import pg from "pg";

const REQUIRED_CONFIRMATION = "create-and-delete-disposable-account";

type CookieJar = Map<string, string>;

export function requireSafeTarget(baseUrl: URL) {
  if (process.env.LIFECYCLE_SMOKE_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `set LIFECYCLE_SMOKE_CONFIRM=${REQUIRED_CONFIRMATION} to authorize the disposable lifecycle`
    );
  }

  const loopback = ["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname);
  if (!loopback && process.env.LIFECYCLE_SMOKE_ALLOW_REMOTE !== "true") {
    throw new Error("remote targets require LIFECYCLE_SMOKE_ALLOW_REMOTE=true and release approval");
  }
}

function rememberCookies(jar: CookieJar, headers: Headers) {
  const cookieHeaders =
    (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
    (headers.get("set-cookie")?.split(/,(?=\s*[^;,]+=)/) ?? []);

  for (const header of cookieHeaders) {
    const pair = header.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader(jar: CookieJar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(baseUrl: URL, path: string, jar: CookieJar, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (jar.size > 0) headers.set("Cookie", cookieHeader(jar));
  const response = await fetch(new URL(path, baseUrl), { ...init, headers, redirect: "manual" });
  rememberCookies(jar, response.headers);
  return response;
}

async function signIn(baseUrl: URL, email: string, password: string) {
  const jar: CookieJar = new Map();
  const csrfResponse = await request(baseUrl, "/api/auth/csrf", jar);
  if (!csrfResponse.ok) throw new Error(`csrf request returned ${csrfResponse.status}`);
  const csrf = (await csrfResponse.json()) as { csrfToken?: string };
  if (!csrf.csrfToken) throw new Error("csrf token missing");

  const callbackUrl = new URL("/onboarding", baseUrl).toString();
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password,
    callbackUrl,
    json: "true",
  });
  const response = await request(baseUrl, "/api/auth/callback/credentials", jar, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = (await response.json()) as { url?: string };
  return { jar, callbackUrl, response, url: result.url };
}

async function assertDatabaseDeletion(userId: string) {
  if (!process.env.DATABASE_URL) return "not-requested";
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const user = await pool.query<{ count: string }>(
      'select count(*)::text as count from users where id = $1',
      [userId]
    );
    const owned = await pool.query<{ count: string }>(
      `select (
        (select count(*) from todos where "userId" = $1) +
        (select count(*) from habits where "userId" = $1) +
        (select count(*) from goals where "userId" = $1) +
        (select count(*) from product_events where "userId" = $1) +
        (select count(*) from accounts where "userId" = $1)
      )::text as count`,
      [userId]
    );
    if (user.rows[0]?.count !== "0" || owned.rows[0]?.count !== "0") {
      throw new Error("database still contains disposable account rows");
    }
    return "verified-zero-owned-rows";
  } finally {
    await pool.end();
  }
}

export async function runAuthenticatedLifecycleSmoke() {
  const baseUrl = new URL(process.env.LIFECYCLE_SMOKE_BASE_URL ?? "http://127.0.0.1:3000");
  requireSafeTarget(baseUrl);

  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const email = `lifecycle-smoke-${suffix}@synapse.invalid`;
  const password = randomBytes(24).toString("base64url");
  const anonymousJar: CookieJar = new Map();

  const unauthorized = await request(baseUrl, "/api/settings/export", anonymousJar);
  if (unauthorized.status !== 401) throw new Error("anonymous export did not return 401");

  const registration = await request(baseUrl, "/api/auth/register", anonymousJar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Lifecycle Smoke", email, password }),
  });
  if (registration.status !== 201) throw new Error(`registration returned ${registration.status}`);
  const registered = (await registration.json()) as { id?: string };
  if (!registered.id) throw new Error("registration did not return a user id");

  const signedIn = await signIn(baseUrl, email, password);
  if (!signedIn.response.ok || signedIn.url !== signedIn.callbackUrl) {
    throw new Error("credential sign-in did not reach onboarding");
  }
  const session = await request(baseUrl, "/api/auth/session", signedIn.jar);
  const sessionData = (await session.json()) as { user?: { id?: string } };
  if (sessionData.user?.id !== registered.id) throw new Error("session user does not match registration");

  const onboarding = await request(baseUrl, "/api/onboarding", signedIn.jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      skip: false,
      goal: "Validate the private daily loop",
      habit: "Review today before messages",
      task: "Complete lifecycle verification",
      productAnalyticsConsent: true,
    }),
  });
  if (!onboarding.ok) throw new Error(`onboarding returned ${onboarding.status}`);

  const exported = await request(baseUrl, "/api/settings/export", signedIn.jar);
  if (!exported.ok) throw new Error(`export returned ${exported.status}`);
  if (!exported.headers.get("content-disposition")?.includes("synapse-export.json")) {
    throw new Error("export attachment filename is missing");
  }
  const archive = (await exported.json()) as Record<string, unknown> & {
    format?: string;
    version?: number;
    profile?: { email?: string; accessToken?: unknown; anthropicApiKey?: unknown; openaiApiKey?: unknown };
    goals?: unknown[];
    habits?: unknown[];
    todos?: unknown[];
    productEvents?: Array<{ name?: string }>;
    security?: { excluded?: string[] };
  };
  const eventNames = archive.productEvents?.map(({ name }) => name).sort();
  if (
    archive.format !== "synapse-portable-export" ||
    archive.version !== 3 ||
    archive.profile?.email !== email ||
    archive.goals?.length !== 1 ||
    archive.habits?.length !== 1 ||
    archive.todos?.length !== 1 ||
    JSON.stringify(eventNames) !== JSON.stringify(["EXPORT_SUCCEEDED", "FIRST_PLAN_CREATED"]) ||
    archive.profile.accessToken !== undefined ||
    archive.profile.anthropicApiKey !== undefined ||
    archive.profile.openaiApiKey !== undefined ||
    !archive.security?.excluded?.includes("password hashes") ||
    !archive.security?.excluded?.includes("sessions and authentication tokens")
  ) {
    throw new Error("portable export contract failed");
  }

  const wrongPassword = await request(baseUrl, "/api/account", signedIn.jar, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE", password: "deliberately-wrong" }),
  });
  if (wrongPassword.status !== 403) throw new Error("wrong-password deletion did not return 403");

  const deletion = await request(baseUrl, "/api/account", signedIn.jar, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE", password }),
  });
  if (!deletion.ok || ((await deletion.json()) as { deleted?: boolean }).deleted !== true) {
    throw new Error(`credential-confirmed deletion returned ${deletion.status}`);
  }

  const reauthentication = await signIn(baseUrl, email, password);
  if (reauthentication.response.ok && reauthentication.url === reauthentication.callbackUrl) {
    throw new Error("deleted credentials still authenticate");
  }

  return {
    target: baseUrl.origin,
    anonymousExport: "denied",
    registration: "created-disposable-account",
    authentication: "verified",
    onboarding: "goal-habit-task-created",
    export: "portable-contract-verified",
    wrongPasswordDeletion: "denied-and-account-preserved",
    deletion: "credential-confirmed",
    reauthentication: "denied-after-deletion",
    databaseDeletion: await assertDatabaseDeletion(registered.id),
  };
}

if (process.argv[1]?.endsWith("authenticated-lifecycle-smoke.ts")) {
  runAuthenticatedLifecycleSmoke()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(`[lifecycle-smoke] ${error instanceof Error ? error.message : "failed"}`);
      process.exitCode = 1;
    });
}
