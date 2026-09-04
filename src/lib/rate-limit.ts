import { createHash } from "node:crypto";

type Bucket = {
  count: number;
  resetAt: number;
};

type Limit = {
  namespace: string;
  identifier: string;
  maxAttempts: number;
  windowMs: number;
};

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

export function consumeRateLimit(limit: Limit, now = Date.now()): RateLimitResult {
  prune(now);
  const key = `${limit.namespace}:${digest(limit.identifier.trim().toLowerCase())}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { allowed: true, remaining: limit.maxAttempts - 1 };
  }

  if (existing.count >= limit.maxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit.maxAttempts - existing.count };
}

export function trustedClientIp(request: Request): string | null {
  if (process.env.TRUST_PROXY !== "true") return null;

  const candidate =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip");

  if (!candidate || candidate.length > 64 || !/^[0-9a-f:.]+$/i.test(candidate)) {
    return null;
  }
  return candidate;
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Too many authentication attempts. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    }
  );
}

export function resetRateLimitsForTests(): void {
  if (process.env.NODE_ENV !== "test") return;
  buckets.clear();
}
