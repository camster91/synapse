"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { User, Key, Download, Palette, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [preferredAiProvider, setPreferredAiProvider] = useState("anthropic");
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false);
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [productAnalyticsConsent, setProductAnalyticsConsent] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
    fetch("/api/settings")
      .then(async (r) => {
        if (!r.ok) throw new Error("Settings request failed");
        return r.json();
      })
      .then((data) => {
        setName(data.name || "");
        setEmail(data.email || "");
        setTimezone(data.timezone || "America/New_York");
        setPreferredAiProvider(
          data.preferredAiProvider === "ollama" && !data.ollamaAvailable
            ? "anthropic"
            : data.preferredAiProvider || "anthropic"
        );
        setHasAnthropicKey(Boolean(data.hasAnthropicKey));
        setHasOpenaiKey(Boolean(data.hasOpenaiKey));
        setOllamaAvailable(Boolean(data.ollamaAvailable));
        setProductAnalyticsConsent(Boolean(data.productAnalyticsConsent));
        setSettingsLoaded(true);
      })
      .catch(() => {
        setError("Unable to load settings. Refresh the page and try again.");
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          timezone: timezone || undefined,
          anthropicApiKey: anthropicKey || undefined,
          openaiApiKey: openaiKey || undefined,
          preferredAiProvider,
          productAnalyticsConsent,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save settings");
        setSaving(false);
        return;
      }
      const data = await res.json();
      setHasAnthropicKey(Boolean(data.hasAnthropicKey));
      setHasOpenaiKey(Boolean(data.hasOpenaiKey));
      setAnthropicKey("");
      setOpenaiKey("");
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
      return;
    }
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("synapse-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("synapse-theme", "light");
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportData = async () => {
    setError(null);
    const res = await fetch("/api/settings/export");
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "synapse-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      setError("Data export failed. Please try again.");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation, password: deletePassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Account deletion failed");
      }
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account deletion failed");
      setDeleting(false);
    }
  };

  const sections = [
    { id: "profile", label: "Profile", icon: User },
    { id: "ai", label: "AI Provider", icon: Key },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "data", label: "Data", icon: Download },
    { id: "delete-account", label: "Delete account", icon: Trash2 },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <nav className="lg:col-span-1">
          <div className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </a>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* Profile */}
          <section id="profile" className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Profile</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Profile photo editing is not available in this beta.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  aria-readonly="true"
                  placeholder="you@example.com"
                  className="w-full min-h-11 px-3 py-2 bg-muted/40 border border-input rounded-lg text-sm text-muted-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">Email changes are not available in this beta.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="America/New_York">Eastern (New York)</option>
                  <option value="America/Chicago">Central (Chicago)</option>
                  <option value="America/Denver">Mountain (Denver)</option>
                  <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                  <option value="Australia/Sydney">Sydney</option>
                </select>
              </div>
            </div>
          </section>

          {/* AI Provider */}
          <section id="ai" className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">AI Provider</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Connect a provider for your own chat usage. Keys are encrypted before storage and are never shown again.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Preferred provider</label>
                <select value={preferredAiProvider} onChange={(e) => setPreferredAiProvider(e.target.value)} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  {ollamaAvailable && <option value="ollama">Ollama (managed by this instance)</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Anthropic API Key</label>
                <input
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {hasAnthropicKey && <p className="mt-1 text-xs text-emerald-600">Connected. Enter a new key only to replace it.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">OpenAI API Key</label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {hasOpenaiKey && <p className="mt-1 text-xs text-emerald-600">Connected. Enter a new key only to replace it.</p>}
              </div>
              {ollamaAvailable && (
                <p className="text-xs text-muted-foreground">
                  Ollama is connected by the instance operator. Its network address is not exposed or changed from your account.
                </p>
              )}
            </div>
          </section>

          {/* Appearance */}
          <section id="appearance" className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Appearance</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Dark Mode</p>
                <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  darkMode ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    darkMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Data Export */}
          <section id="data" className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Data</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Download a portable JSON archive of your profile and user-owned content. Uploaded files are included as base64 data; reusable credentials are excluded for security.
            </p>
            <button
              onClick={handleExportData}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Data
            </button>
            <label className="mt-5 flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <input
                type="checkbox"
                checked={productAnalyticsConsent}
                onChange={(event) => setProductAnalyticsConsent(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Share private-beta activity signals</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Stores only first plan created, Today opened, and export succeeded in this Synapse instance. No content, browsing history, device data, or third-party analytics. Turning this off deletes previously stored signals when you save.
                </span>
              </span>
            </label>
          </section>

          <section id="delete-account" className="rounded-xl border border-destructive/30 bg-card p-6">
            <h2 className="text-lg font-semibold text-destructive">Delete account</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Permanently remove your account, records, conversations, and uploaded files. Export first if you need a copy. This cannot be undone.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="delete-password" className="mb-1 block text-sm font-medium text-foreground">Current password</label>
                <input id="delete-password" type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} autoComplete="current-password" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label htmlFor="delete-confirmation" className="mb-1 block text-sm font-medium text-foreground">Type DELETE to confirm</label>
                <input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <button type="button" onClick={handleDeleteAccount} disabled={deleting || deleteConfirmation !== "DELETE"} className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting account…" : "Permanently delete account"}
              </button>
            </div>
          </section>

          {/* Save Button */}
          <div className="flex justify-end items-center gap-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              onClick={handleSave}
              disabled={saving || !settingsLoaded}
              className="min-h-11 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
