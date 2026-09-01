"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Puzzle,
  Settings,
  Download,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  X,
} from "lucide-react";
import Modal from "@/components/Modal";
import ResourceLoadError from "@/components/ResourceLoadError";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfigFieldDefinition {
  type: "string" | "number" | "boolean" | "select";
  label: string;
  default?: unknown;
  required?: boolean;
  options?: string[];
}

interface PluginManifest {
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  icon?: string;
  homepage?: string;
  permissions: string[];
  configSchema?: Record<string, ConfigFieldDefinition>;
}

interface UserPluginInfo {
  manifest: PluginManifest;
  enabled: boolean;
  config: Record<string, unknown> | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PluginsPage() {
  const [allPlugins, setAllPlugins] = useState<PluginManifest[]>([]);
  const [userPlugins, setUserPlugins] = useState<UserPluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"browse" | "installed">("browse");
  const [search, setSearch] = useState("");
  const [configuring, setConfiguring] = useState<UserPluginInfo | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState("");

  // Fetch all available plugins and user's installed plugins
  const fetchPlugins = useCallback(async () => {
    setLoadError(false);
    try {
      const [allRes, userRes] = await Promise.all([
        fetch("/api/plugins"),
        fetch("/api/plugins?installed=true"),
      ]);

      if (!allRes.ok || !userRes.ok) throw new Error("Plugins request failed");
      setAllPlugins(await allRes.json());
      setUserPlugins(await userRes.json());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const isInstalled = (name: string) =>
    userPlugins.some((p) => p.manifest.name === name);

  const installPlugin = async (pluginName: string) => {
    setActionLoading(pluginName);
    setActionError("");
    try {
      const res = await fetch("/api/plugins/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginName }),
      });
      if (!res.ok) throw new Error("Install failed");
      await fetchPlugins();
    } catch {
      setActionError("The plugin could not be installed. Nothing was changed.");
    } finally {
      setActionLoading(null);
    }
  };

  const uninstallPlugin = async (pluginName: string) => {
    setActionLoading(pluginName);
    setActionError("");
    try {
      const res = await fetch("/api/plugins/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginName }),
      });
      if (!res.ok) throw new Error("Uninstall failed");
      await fetchPlugins();
    } catch {
      setActionError("The plugin could not be removed. Your installation was preserved.");
    } finally {
      setActionLoading(null);
    }
  };

  const togglePlugin = async (pluginName: string, enabled: boolean) => {
    setActionLoading(pluginName);
    setActionError("");
    try {
      const res = await fetch("/api/plugins/configure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginName, config: { _enabled: enabled } }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      await fetchPlugins();
    } catch {
      setActionError("The plugin state could not be updated. Its previous state was preserved.");
    } finally {
      setActionLoading(null);
    }
  };

  const openConfig = (plugin: UserPluginInfo) => {
    setConfiguring(plugin);
    setConfigValues(
      (plugin.config as Record<string, unknown>) ??
        Object.fromEntries(
          Object.entries(plugin.manifest.configSchema ?? {}).map(
            ([key, def]) => [key, def.default]
          )
        )
    );
  };

  const saveConfig = async () => {
    if (!configuring) return;
    setActionLoading(configuring.manifest.name);
    setActionError("");
    try {
      const res = await fetch("/api/plugins/configure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginName: configuring.manifest.name,
          config: configValues,
        }),
      });
      if (!res.ok) throw new Error("Configuration save failed");
      setConfiguring(null);
      await fetchPlugins();
    } catch {
      setActionError("Plugin settings could not be saved. Your previous settings were preserved.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPlugins =
    tab === "browse"
      ? allPlugins.filter(
          (p) =>
            p.displayName.toLowerCase().includes(search.toLowerCase()) ||
            p.description.toLowerCase().includes(search.toLowerCase())
        )
      : userPlugins.filter(
          (p) =>
            p.manifest.displayName
              .toLowerCase()
              .includes(search.toLowerCase()) ||
            p.manifest.description
              .toLowerCase()
              .includes(search.toLowerCase())
        );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Puzzle className="w-8 h-8 text-primary" />
              Plugins
            </h1>
            <p className="text-muted-foreground mt-1">
              Extend Synapse with community and built-in plugins
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-muted/50 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab("browse")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "browse"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setTab("installed")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "installed"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Plugins
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Loading */}
        {loadError ? (
          <ResourceLoadError resource="plugins" onRetry={fetchPlugins} />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredPlugins.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            {tab === "browse"
              ? "No plugins available yet"
              : "No plugins installed"}
          </div>
        ) : (
          /* Plugin Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(tab === "browse" ? filteredPlugins : filteredPlugins).map(
              (item) => {
                const manifest =
                  tab === "browse"
                    ? (item as PluginManifest)
                    : (item as UserPluginInfo).manifest;
                const installed = isInstalled(manifest.name);
                const userPlugin = userPlugins.find(
                  (p) => p.manifest.name === manifest.name
                );
                const isLoading = actionLoading === manifest.name;

                return (
                  <div
                    key={manifest.name}
                    className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{manifest.icon ?? "📦"}</span>
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {manifest.displayName}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            v{manifest.version} by {manifest.author}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {manifest.description}
                    </p>

                    {/* Permissions */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {manifest.permissions.slice(0, 4).map((perm) => (
                        <span
                          key={perm}
                          className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded"
                        >
                          {perm}
                        </span>
                      ))}
                      {manifest.permissions.length > 4 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                          +{manifest.permissions.length - 4}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {tab === "browse" && !installed && (
                        <button
                          onClick={() => installPlugin(manifest.name)}
                          disabled={isLoading}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {isLoading ? "Installing..." : "Install"}
                        </button>
                      )}
                      {tab === "browse" && installed && (
                        <span className="flex-1 text-center py-2 text-sm text-green-600 dark:text-green-400 font-medium">
                          Installed
                        </span>
                      )}
                      {tab === "installed" && userPlugin && (
                        <>
                          <button
                            onClick={() =>
                              togglePlugin(
                                manifest.name,
                                !userPlugin.enabled
                              )
                            }
                            disabled={isLoading}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
                            title={userPlugin.enabled ? "Disable" : "Enable"}
                          >
                            {userPlugin.enabled ? (
                              <>
                                <ToggleRight className="w-4 h-4 text-green-600 dark:text-green-400" />
                                <span className="text-sm">On</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">Off</span>
                              </>
                            )}
                          </button>
                          {manifest.configSchema &&
                            Object.keys(manifest.configSchema).length > 0 && (
                              <button
                                onClick={() => openConfig(userPlugin)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
                              >
                                <Settings className="w-4 h-4" />
                                Settings
                              </button>
                            )}
                          <button
                            onClick={() => uninstallPlugin(manifest.name)}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 border border-red-300 dark:border-red-900/50 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
        {actionError && (
          <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {actionError}
          </p>
        )}
      </div>

      {/* Config Modal */}
      <Modal
        isOpen={configuring !== null}
        onClose={() => setConfiguring(null)}
        title={configuring ? `${configuring.manifest.displayName} Settings` : ""}
        size="md"
      >
        {configuring && configuring.manifest.configSchema && (
          <div className="space-y-4">
            {Object.entries(configuring.manifest.configSchema).map(
              ([key, field]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                  </label>

                  {field.type === "select" && field.options ? (
                    <select
                      value={String(configValues[key] ?? field.default ?? "")}
                      onChange={(e) =>
                        setConfigValues((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "boolean" ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(configValues[key] ?? field.default ?? false)}
                        onChange={(e) =>
                          setConfigValues((prev) => ({
                            ...prev,
                            [key]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-muted-foreground">
                        {String(field.default ? "Enabled" : "Disabled")}
                      </span>
                    </label>
                  ) : field.type === "number" ? (
                    <input
                      type="number"
                      value={Number(configValues[key] ?? field.default ?? 0)}
                      onChange={(e) =>
                        setConfigValues((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(configValues[key] ?? field.default ?? "")}
                      onChange={(e) =>
                        setConfigValues((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  )}
                </div>
              )
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfiguring(null)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveConfig}
                disabled={actionLoading !== null}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
