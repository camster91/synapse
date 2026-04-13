import fs from "fs";
import path from "path";
import { pluginRegistry } from "./registry";
import type { PluginManifest } from "./types";

// ─── Config ───────────────────────────────────────────────────────────────────

const PLUGINS_DIR = path.resolve(process.cwd(), "plugins");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recursively find all manifest.json files under the plugins directory.
 */
function discoverManifests(): string[] {
  if (!fs.existsSync(PLUGINS_DIR)) {
    return [];
  }

  const manifests: string[] = [];

  for (const entry of fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(PLUGINS_DIR, entry.name, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      manifests.push(manifestPath);
    }
  }

  return manifests;
}

/**
 * Read and parse a manifest.json file, returning the PluginManifest.
 * Throws on invalid JSON or missing required fields (caught by registry validation).
 */
function parseManifest(manifestPath: string): PluginManifest {
  const raw = fs.readFileSync(manifestPath, "utf-8");
  const json = JSON.parse(raw);

  // Include hooks in the manifest so they can be resolved at runtime
  return json as PluginManifest;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scan the plugins directory, parse manifests, validate, and register
 * all discovered plugins with the registry.  Returns the list of
 * successfully loaded plugin names.
 */
export function loadAllPlugins(): string[] {
  const loaded: string[] = [];
  const errors: Array<{ plugin: string; error: string }> = [];

  // Sync the Plugin table with discovered manifests
  const manifests = discoverManifests();

  for (const manifestPath of manifests) {
    try {
      const manifest = parseManifest(manifestPath);
      pluginRegistry.registerPlugin(manifest);
      loaded.push(manifest.name);
    } catch (err) {
      const dir = path.basename(path.dirname(manifestPath));
      errors.push({
        plugin: dir,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (errors.length > 0) {
    console.warn(
      "[plugin-loader] Some plugins failed to load:",
      errors.map((e) => `${e.plugin}: ${e.error}`).join("; ")
    );
  }

  console.info(
    `[plugin-loader] Loaded ${loaded.length} plugin(s): ${loaded.join(", ") || "(none)"}`
  );

  return loaded;
}

/**
 * Hot-reload a single plugin by name.  Removes it from the registry,
 * re-parses its manifest, and re-registers.
 */
export function reloadPlugin(name: string): boolean {
  const manifestPath = path.join(PLUGINS_DIR, name, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    console.warn(`[plugin-loader] Cannot reload "${name}": manifest not found`);
    return false;
  }

  // Remove the old registration
  pluginRegistry.unregisterPlugin(name);

  try {
    const manifest = parseManifest(manifestPath);
    pluginRegistry.registerPlugin(manifest);
    console.info(`[plugin-loader] Reloaded plugin "${name}"`);
    return true;
  } catch (err) {
    console.error(
      `[plugin-loader] Failed to reload "${name}":`,
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

/**
 * Remove a plugin from the registry entirely.  Does NOT delete its files.
 */
export function unloadPlugin(name: string): boolean {
  const removed = pluginRegistry.unregisterPlugin(name);
  if (removed) {
    console.info(`[plugin-loader] Unloaded plugin "${name}"`);
  } else {
    console.warn(`[plugin-loader] Plugin "${name}" was not registered`);
  }
  return removed;
}

/**
 * Return the absolute path to the plugins directory.
 */
export function getPluginsDir(): string {
  return PLUGINS_DIR;
}