import { randomBytes } from "node:crypto";
import { readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const REQUIRED_CONFIRMATION = "create-and-delete-disposable-account";

type CookieJar = Map<string, string>;
type CapturedAuthEmail = {
  kind?: string;
  to?: string;
  text?: string;
  createdAt?: string;
};

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

async function request(baseUrl: URL, requestPath: string, jar: CookieJar, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (jar.size > 0) headers.set("Cookie", cookieHeader(jar));
  const response = await fetch(new URL(requestPath, baseUrl), { ...init, headers, redirect: "manual" });
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

function tokenFromCapturedEmail(message: CapturedAuthEmail) {
  const match = message.text?.match(/https?:\/\/\S+/);
  if (!match) return null;
  try {
    const actionUrl = new URL(match[0]);
    return new URLSearchParams(actionUrl.hash.slice(1)).get("token");
  } catch {
    return null;
  }
}

async function waitForCapturedToken(input: {
  kind: "verification" | "password_reset";
  email: string;
  notBefore: number;
}) {
  if (process.env.EMAIL_PROVIDER !== "file") {
    throw new Error("lifecycle smoke requires EMAIL_PROVIDER=file for disposable email capture");
  }
  const directory = process.env.AUTH_EMAIL_FILE_DIR;
  if (!directory) throw new Error("AUTH_EMAIL_FILE_DIR is required for lifecycle smoke");

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const filenames = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });

    for (const filename of filenames.filter((name) => name.endsWith(".json")).sort().reverse()) {
      const filepath = path.join(directory, filename);
      try {
        const message = JSON.parse(await readFile(filepath, "utf8")) as CapturedAuthEmail;
        const createdAt = message.createdAt ? new Date(message.createdAt).getTime() : 0;
        if (
          message.kind !== input.kind ||
          message.to !== input.email ||
          !Number.isFinite(createdAt) ||
          createdAt < input.notBefore
        ) {
          continue;
        }

        const token = tokenFromCapturedEmail(message);
        if (!token) throw new Error("captured authentication email did not contain a fragment token");
        await unlink(filepath);
        return token;
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`timed out waiting for ${input.kind} email`);
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
        (select count(*) from accounts where "userId" = $1) +
        (select count(*) from sessions where "userId" = $1) +
        (select count(*) from verification_tokens where identifier in ('verify:' || $1, 'reset:' || $1))
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
  const resetPassword = randomBytes(24).toString("base64url");
  const anonymousJar: CookieJar = new Map();

  const unauthorized = await request(baseUrl, "/api/settings/export", anonymousJar);
  if (unauthorized.status !== 401) throw new Error("anonymous export did not return 401");

  const registrationStarted = Date.now();
  const registration = await request(baseUrl, "/api/auth/register", anonymousJar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Lifecycle Smoke", email, password }),
  });
  if (registration.status !== 201) throw new Error(`registration returned ${registration.status}`);
  const registered = (await registration.json()) as { accepted?: boolean; id?: string };
  if (registered.accepted !== true || registered.id !== undefined) {
    throw new Error("registration response was not enumeration neutral");
  }

  const verificationToken = await waitForCapturedToken({
    kind: "verification",
    email,
    notBefore: registrationStarted,
  });
  const verification = await request(baseUrl, "/api/auth/verify-email", anonymousJar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: verificationToken }),
  });
  if (!verification.ok || ((await verification.json()) as { verified?: boolean }).verified !== true) {
    throw new Error(`verification returned ${verification.status}`);
  }
  const verificationReplay = await request(baseUrl, "/api/auth/verify-email", anonymousJar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: verificationToken }),
  });
  if (verificationReplay.status !== 400) throw new Error("verification token replay was not denied");

  const signedIn = await signIn(baseUrl, email, password);
  if (!signedIn.response.ok || signedIn.url !== signedIn.callbackUrl) {
    throw new Error("credential sign-in did not reach onboarding");
  }
  const session = await request(baseUrl, "/api/auth/session", signedIn.jar);
  const sessionData = (await session.json()) as { user?: { id?: string } };
  const userId = sessionData.user?.id;
  if (!userId) throw new Error("verified session did not contain a user id");

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

  const resetStarted = Date.now();
  const forgot = await request(baseUrl, "/api/auth/forgot-password", anonymousJar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (forgot.status !== 202 || ((await forgot.json()) as { accepted?: boolean }).accepted !== true) {
    throw new Error(`forgot-password returned ${forgot.status}`);
  }

  const resetToken = await waitForCapturedToken({
    kind: "password_reset",
    email,
    notBefore: resetStarted,
  });
  const reset = await request(baseUrl, "/api/auth/reset-password", anonymousJar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetToken, password: resetPassword }),
  });
  if (!reset.ok || ((await reset.json()) as { reset?: boolean }).reset !== true) {
    throw new Error(`password reset returned ${reset.status}`);
  }
  const resetReplay = await request(baseUrl, "/api/auth/reset-password", anonymousJar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetToken, password: resetPassword }),
  });
  if (resetReplay.status !== 400) throw new Error("password reset token replay was not denied");

  const oldSession = await request(baseUrl, "/api/auth/session", signedIn.jar);
  const oldSessionData = (await oldSession.json()) as { user?: { id?: string } };
  if (oldSessionData.user?.id) throw new Error("pre-reset session remained authenticated");

  const oldPasswordAttempt = await signIn(baseUrl, email, password);
  if (oldPasswordAttempt.response.ok && oldPasswordAttempt.url === oldPasswordAttempt.callbackUrl) {
    throw new Error("old password still authenticated after reset");
  }

  const resetSignedIn = await signIn(baseUrl, email, resetPassword);
  if (!resetSignedIn.response.ok || resetSignedIn.url !== resetSignedIn.callbackUrl) {
    throw new Error("new password did not authenticate after reset");
  }
  const resetSession = await request(baseUrl, "/api/auth/session", resetSignedIn.jar);
  const resetSessionData = (await resetSession.json()) as { user?: { id?: string } };
  if (resetSessionData.user?.id !== userId) throw new Error("reset session user did not match account");

  const wrongPassword = await request(baseUrl, "/api/account", resetSignedIn.jar, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE", password: "deliberately-wrong" }),
  });
  if (wrongPassword.status !== 403) throw new Error("wrong-password deletion did not return 403");

  const deletion = await request(baseUrl, "/api/account", resetSignedIn.jar, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE", password: resetPassword }),
  });
  if (!deletion.ok || ((await deletion.json()) as { deleted?: boolean }).deleted !== true) {
    throw new Error(`credential-confirmed deletion returned ${deletion.status}`);
  }

  const reauthentication = await signIn(baseUrl, email, resetPassword);
  if (reauthentication.response.ok && reauthentication.url === reauthentication.callbackUrl) {
    throw new Error("deleted credentials still authenticate");
  }

  return {
    target: baseUrl.origin,
    anonymousExport: "denied",
    registration: "created-enumeration-neutral-disposable-account",
    emailVerification: "delivered-consumed-and-replay-denied",
    authentication: "verified",
    onboarding: "goal-habit-task-created",
    export: "portable-contract-verified",
    passwordReset: "delivered-consumed-and-replay-denied",
    oldSession: "invalidated",
    oldPassword: "denied",
    newPassword: "authenticated",
    wrongPasswordDeletion: "denied-and-account-preserved",
    deletion: "credential-confirmed",
    reauthentication: "denied-after-deletion",
    databaseDeletion: await assertDatabaseDeletion(userId),
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
