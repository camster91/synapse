"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    let showTimer: number | null = null;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallError(null);
      // Show prompt after a short delay so it doesn't flash immediately
      showTimer = window.setTimeout(() => setShow(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return () => {
        if (showTimer !== null) window.clearTimeout(showTimer);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => {
      if (showTimer !== null) window.clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt || installing) return;
    setInstalling(true);
    setInstallError(null);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setShow(false);
    } catch {
      setInstallError("Installation could not be opened. Use your browser's install option instead.");
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  }

  if (!show) return null;

  return (
    <div role="region" aria-labelledby="pwa-install-title" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-card border border-border rounded-xl shadow-lg z-50 p-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 id="pwa-install-title" className="text-sm font-semibold text-foreground">
            Install Synapse
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add Synapse to your home screen for quicker access
          </p>
          <div className="flex gap-2 mt-3">
            {deferredPrompt && (
              <button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                {installing ? "Opening install…" : "Install"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShow(false)}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Not now
            </button>
          </div>
          {installError && <p role="alert" className="mt-2 text-xs text-destructive">{installError}</p>}
        </div>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={() => setShow(false)}
          className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
