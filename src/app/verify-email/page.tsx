"use client";

import { useEffect, useState } from "react";

export default function VerifyEmailPage() {
  const [state, setState] = useState<"waiting" | "verifying" | "verified" | "error">("waiting");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;

    setState("verifying");
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("verification failed");
        setState("verified");
      })
      .catch(() => setState("error"));
  }, []);

  const title = state === "verified" ? "Email verified" : state === "error" ? "Verification link unavailable" : state === "verifying" ? "Verifying your email…" : "Check your email";
  const message = state === "verified"
    ? "Your email is verified. You can sign in to Synapse."
    : state === "error"
      ? "This verification link is invalid, expired, or has already been used."
      : state === "verifying"
        ? "This should only take a moment."
        : "Use the verification link we sent. Links expire after 30 minutes.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <main className="w-full max-w-sm text-center" aria-live="polite">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground text-xl font-bold mb-4">S</div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{message}</p>

        <div className="mt-6 space-y-3">
          {state === "verified" ? (
            <a href="/login" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Sign in</a>
          ) : (
            <a href="/resend-verification" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Send a new verification email</a>
          )}
          <a href="/login" className="inline-block text-sm text-primary hover:underline">Back to sign in</a>
        </div>
      </main>
    </div>
  );
}
