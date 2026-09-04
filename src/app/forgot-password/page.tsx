"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.status === 503) {
        setError("Password email is temporarily unavailable. Please try again later.");
      } else if (!response.ok) {
        setError("We could not process that request right now.");
      } else {
        setMessage("If a credentials account exists for that email, a reset link has been sent.");
      }
    } catch {
      setError("Unable to send the request. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <main className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground text-xl font-bold mb-4">S</div>
          <h1 className="text-2xl font-bold text-foreground">Reset your password</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your account email and we’ll send a time-limited reset link.</p>
        </div>
        <form onSubmit={submit} className="space-y-4" aria-busy={submitting}>
          {message && <div role="status" className="p-3 text-sm rounded-lg bg-muted text-foreground">{message}</div>}
          {error && <div role="alert" className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive">{error}</div>}
          <div>
            <label htmlFor="forgot-email" className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} className="w-full min-h-11 px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" />
          </div>
          <button type="submit" disabled={submitting} className="w-full min-h-11 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-60">{submitting ? "Sending…" : "Send reset link"}</button>
        </form>
        <p className="mt-6 text-center text-sm"><a href="/login" className="text-primary hover:underline">Back to sign in</a></p>
      </main>
    </div>
  );
}
