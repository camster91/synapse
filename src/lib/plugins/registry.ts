import type { PluginManifest, PluginPermission } from "./types";
import { prisma } from "@/lib/prisma";

// ─── Validation ────────────────────────────────────────────────────────────────

const VALID_PERMISSIONS: Set<string> = new Set<PluginPermission>([
  "read:habits", "write:habits",
  "read:todos", "write:todos",
  "read:notes", "write:notes",
  "read:journal", "write:journal",
  "read:calendar", "write:calendar",
  "read:goals", "write:goals",
  "read:inbox", "write:inbox",
  "read:profile", "write:profile",
  "access:ai",
]);

function validateManifest(manifest: PluginManifest): string[] {
  const errors: string[] = [];

  if (!manifest.name || !/^[a-z0-9-]+$/.test(manifest.name)) {
    errors.push("name must be a lowercase kebab-case string (e.g. finance-tracker)");
  }
  if (!manifest.displayName || manifest.displayName.trim().length === 0) {
    errors.push("displayName is required");
  }
  if (!manifest.version || !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push("version must be semver (e.g. 1.0.0)");
  }
  if (!manifest.description || manifest.description.trim().length === 0) {
    errors.push("description is required");
  }
  if (!manifest.author || manifest.author.trim().length === 0) {
    errors.push("author is required");
  }
  if (!Array.isArray(manifest.permissions) || manifest.permissions.length === 0) {
    errors.push("permissions must be a non-empty array");
  } else {
    for (const perm of manifest.permissions) {
      if (!VALID_PERMISSIONS.has(perm)) {
        errors.push(`unknown permission: ${perm}`);
      }
    }
  }

  return errors;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

class PluginRegistry {
  private plugins = new Map<string, PluginManifest>();
  private loaded = false;

  /**
   * Ensure plugins have been loaded from the filesystem.
   * Called lazily before any read operation so we never serve stale data
   * on the very first request after a cold start.
   */
  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      // Dynamic import avoids pulling fs/path into client bundles
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadAllPlugins } = require("./loader");
      loadAllPlugins();
    } catch {
      // May fail in edge runtime or during build; that is fine.
    }
  }

  /**
   * Validate and register a plugin manifest.  Throws if validation fails.
   */
  registerPlugin(manifest: PluginManifest): void {
    const errors = validateManifest(manifest);
    if (errors.length > 0) {
      throw new Error(`Invalid plugin manifest "${manifest.name}": ${errors.join("; ")}`);
    }

    if (this.plugins.has(manifest.name)) {
      throw new Error(`Plugin "${manifest.name}" is already registered`);
    }

    this.plugins.set(manifest.name, manifest);
  }

  /**
   * Get a single plugin manifest by name.
   */
  getPlugin(name: string): PluginManifest | undefined {
    this.ensureLoaded();
    return this.plugins.get(name);
  }

  /**
   * Return all registered plugin manifests.
   */
  getAllPlugins(): PluginManifest[] {
    this.ensureLoaded();
    return Array.from(this.plugins.values());
  }

  /**
   * Return the plugins a given user has installed (enabled or disabled).
   */
  async getUserPlugins(userId: string): Promise<
    Array<{ manifest: PluginManifest; enabled: boolean; config: Record<string, unknown> | null }>
  > {
    this.ensureLoaded();
    const userPlugins = await prisma.userPlugin.findMany({
      where: { userId },
      include: { plugin: true },
    });

    return userPlugins
      .map((up) => {
        const manifest = this.plugins.get(up.plugin.name);
        if (!manifest) return null;
        return {
          manifest,
          enabled: up.enabled,
          config: (up.config as Record<string, unknown>) ?? null,
        };
      })
      .filter(Boolean) as Array<{
        manifest: PluginManifest;
        enabled: boolean;
        config: Record<string, unknown> | null;
      }>;
  }

  /**
   * Check whether a plugin holds a specific permission.
   */
  hasPermission(pluginName: string, permission: PluginPermission): boolean {
    this.ensureLoaded();
    const manifest = this.plugins.get(pluginName);
    if (!manifest) return false;
    return manifest.permissions.includes(permission);
  }

  /**
   * Remove a plugin from the registry.
   */
  unregisterPlugin(name: string): boolean {
    return this.plugins.delete(name);
  }

  /**
   * Clear all registered plugins (useful for tests or hot-reload).
   */
  clear(): void {
    this.plugins.clear();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const pluginRegistry = new PluginRegistry();
export { PluginRegistry };