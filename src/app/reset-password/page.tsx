"use client";

import { useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setMessage("");
    if (!token) {
      setError("This reset link is invalid or incomplete.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) {
        setError("This reset link is invalid, expired, or has already been used.");
        return;
      }
      setComplete(true);
      setPassword("");
      setConfirmPassword("");
      setMessage("Your password has been reset. Previous signed-in sessions will no longer be accepted.");
    } catch {
      setError("Unable to reset your password. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <main className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground text-xl font-bold mb-4">S</div>
          <h1 className="text-2xl font-bold text-foreground">Choose a new password</h1>
          <p className="text-sm text-muted-foreground mt-1">Reset links expire after 30 minutes and can only be used once.</p>
        </div>

        {message && <div role="status" className="mb-4 p-3 text-sm rounded-lg bg-muted text-foreground">{message}</div>}
        {error && <div role="alert" className="mb-4 p-3 text-sm rounded-lg bg-destructive/10 text-destructive">{error}</div>}

        {!complete ? (
          <form onSubmit={submit} className="space-y-4" aria-busy={submitting}>
            <div>
              <label htmlFor="reset-password" className="block text-sm font-medium text-foreground mb-1">New password</label>
              <input id="reset-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} className="w-full min-h-11 px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" />
            </div>
            <div>
              <label htmlFor="reset-password-confirm" className="block text-sm font-medium text-foreground mb-1">Confirm password</label>
              <input id="reset-password-confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={submitting} className="w-full min-h-11 px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" />
            </div>
            <button type="submit" disabled={submitting} className="w-full min-h-11 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-60">{submitting ? "Resetting…" : "Reset password"}</button>
          </form>
        ) : (
          <a href="/login" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Sign in</a>
        )}
      </main>
    </div>
  );
}
