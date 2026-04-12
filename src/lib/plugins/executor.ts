import type {
  PluginContext,
  PluginHooks,
  HookName,
  PluginLogger,
  PermissionScopedDb,
} from "./types";
import { pluginRegistry } from "./registry";
import { prisma } from "@/lib/prisma";

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_CALLS = 100;

const rateLimitBuckets = new Map<
  string,
  { calls: number; windowStart: number }
>();

function checkRateLimit(pluginName: string): void {
  const now = Date.now();
  const key = pluginName;
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(key, { calls: 1, windowStart: now });
    return;
  }

  bucket.calls += 1;
  if (bucket.calls > RATE_LIMIT_MAX_CALLS) {
    throw new Error(
      `Plugin "${pluginName}" exceeded rate limit of ${RATE_LIMIT_MAX_CALLS} calls per minute`
    );
  }
}

// ─── Permission-scoped DB builder ─────────────────────────────────────────────

/**
 * Build a DB proxy that only exposes models matching the plugin's declared
 * permissions.  Read/write methods are conditionally attached based on
 * `read:*` and `write:*` permissions.
 */
function buildScopedDb(
  userId: string,
  permissions: Set<string>
): PermissionScopedDb {
  const userFilter = { where: { userId } };

  /** Wrap a method so it throws a permission error if the plugin lacks access. */
  const requirePerm = <T extends (...a: unknown[]) => unknown>(
    perm: string,
    fn: T
  ): T =>
    (permissions.has(perm)
      ? fn
      : ((() => {
          throw new Error(`Permission denied: ${perm}`);
        }) as unknown as T)) as T;

  return {
    habit: {
      findMany: requirePerm("read:habits", () =>
        prisma.habit.findMany(userFilter)
      ),
    },
    habitLog: {
      findMany: requirePerm("read:habits", () =>
        prisma.habitLog.findMany(userFilter)
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: requirePerm("write:habits", (data: unknown) =>
        prisma.habitLog.create({ data: { ...(data as any), userId } })
      ),
    },
    todo: {
      findMany: requirePerm("read:todos", () =>
        prisma.todo.findMany(userFilter)
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: requirePerm("write:todos", (data: unknown) =>
        prisma.todo.create({ data: { ...(data as any), userId } })
      ),
      update: requirePerm("write:todos", (args: unknown) =>
        prisma.todo.update(args as Parameters<typeof prisma.todo.update>[0])
      ),
    },
    note: {
      findMany: requirePerm("read:notes", () =>
        prisma.note.findMany(userFilter)
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: requirePerm("write:notes", (data: unknown) =>
        prisma.note.create({ data: { ...(data as any), userId } })
      ),
      update: requirePerm("write:notes", (args: unknown) =>
        prisma.note.update(args as Parameters<typeof prisma.note.update>[0])
      ),
    },
    journal: {
      findMany: requirePerm("read:journal", () =>
        prisma.journal.findMany(userFilter)
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: requirePerm("write:journal", (data: unknown) =>
        prisma.journal.create({ data: { ...(data as any), userId } })
      ),
    },
    calendarEvent: {
      findMany: requirePerm("read:calendar", () =>
        prisma.calendarEvent.findMany(userFilter)
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: requirePerm("write:calendar", (data: unknown) =>
        prisma.calendarEvent.create({ data: { ...(data as any), userId } })
      ),
      update: requirePerm("write:calendar", (args: unknown) =>
        prisma.calendarEvent.update(
          args as Parameters<typeof prisma.calendarEvent.update>[0]
        )
      ),
    },
    goal: {
      findMany: requirePerm("read:goals", () =>
        prisma.goal.findMany(userFilter)
      ),
    },
    inboxItem: {
      findMany: requirePerm("read:inbox", () =>
        prisma.inboxItem.findMany(userFilter)
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: requirePerm("write:inbox", (data: unknown) =>
        prisma.inboxItem.create({ data: { ...(data as any), userId } })
      ),
    },
    user: {
      findUnique: requirePerm("read:profile", (args: unknown) =>
        prisma.user.findUnique(
          args as Parameters<typeof prisma.user.findUnique>[0]
        )
      ),
    },
  };
}

// ─── Logger ───────────────────────────────────────────────────────────────────

function createLogger(pluginName: string): PluginLogger {
  const prefix = `[plugin:${pluginName}]`;
  return {
    info: (msg: string) => console.info(prefix, msg),
    warn: (msg: string) => console.warn(prefix, msg),
    error: (msg: string) => console.error(prefix, msg),
  };
}

// ─── Executor ─────────────────────────────────────────────────────────────────

/**
 * Execute a plugin hook with full sandboxing:
 *  - Rate limiting
 *  - Permission-scoped DB access
 *  - try/catch so plugins never crash the host app
 *  - Execution logging
 */
export async function executeHook<T extends HookName>(
  userId: string,
  pluginName: string,
  hookName: T,
  data: Parameters<NonNullable<PluginHooks[T]>>[0]
): Promise<{ success: boolean; error?: string }> {
  // 1. Look up manifest
  const manifest = pluginRegistry.getPlugin(pluginName);
  if (!manifest) {
    return { success: false, error: `Plugin "${pluginName}" not found` };
  }

  // 2. Check plugin is enabled for this user
  const userPlugin = await prisma.userPlugin.findFirst({
    where: { userId, plugin: { name: pluginName }, enabled: true },
  });
  if (!userPlugin) {
    return {
      success: false,
      error: `Plugin "${pluginName}" is not enabled for this user`,
    };
  }

  // 3. Rate limit
  try {
    checkRateLimit(pluginName);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  // 4. Resolve the hook function
  const hookFn = manifest.hooks?.[hookName];
  if (!hookFn || typeof hookFn !== "function") {
    // No hook registered — not an error, just nothing to do.
    return { success: true };
  }

  // 5. Build context
  const permissions = new Set(manifest.permissions);
  const scopedDb = buildScopedDb(userId, permissions);
  const config = (userPlugin.config as Record<string, unknown>) ?? {};

  const context: PluginContext = {
    userId,
    db: scopedDb,
    config,
    logger: createLogger(pluginName),
  };

  // 6. Execute with sandboxing
  try {
    await (hookFn as (data: unknown, ctx: PluginContext) => Promise<void>)(
      data,
      context
    );
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[plugin:${pluginName}] Hook "${hookName}" threw:`, message);
    return { success: false, error: message };
  }
}

/**
 * Fire a hook for ALL installed & enabled plugins for a user.
 * Returns per-plugin results.
 */
export async function fireHookForUser<T extends HookName>(
  userId: string,
  hookName: T,
  data: Parameters<NonNullable<PluginHooks[T]>>[0]
): Promise<Array<{ plugin: string; success: boolean; error?: string }>> {
  const userPlugins = await prisma.userPlugin.findMany({
    where: { userId, enabled: true },
    include: { plugin: true },
  });

  const results: Array<{ plugin: string; success: boolean; error?: string }> =
    [];

  for (const up of userPlugins) {
    const pluginName = up.plugin.name;
    const manifest = pluginRegistry.getPlugin(pluginName);
    if (!manifest) continue; // plugin removed from filesystem but still in DB

    const hookFn = manifest.hooks?.[hookName];
    if (!hookFn || typeof hookFn !== "function") continue;

    const result = await executeHook(userId, pluginName, hookName, data);
    results.push({ plugin: pluginName, ...result });
  }

  return results;
}