"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { safePostAuthenticationPath } from "@/lib/routes";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error === "CredentialsSignin"
          ? "Invalid email or password, or the email still needs verification."
          : "Sign in is temporarily unavailable. Please try again.");
        return;
      }

      if (result?.ok) {
        const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
        router.push(safePostAuthenticationPath(callbackUrl, window.location.origin));
        return;
      }

      setError("Sign in is temporarily unavailable. Please try again.");
    } catch {
      setError("Unable to sign in. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground text-xl font-bold mb-4">S</div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your Synapse account</p>
        </div>

        <form method="post" onSubmit={handleLogin} aria-busy={submitting} className="space-y-4">
          {error && <div role="alert" aria-live="polite" className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>}

          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input id="login-email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required disabled={submitting} className="w-full min-h-11 px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label htmlFor="login-password" className="block text-sm font-medium text-foreground">Password</label>
              <a href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</a>
            </div>
            <input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required disabled={submitting} className="w-full min-h-11 px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60" />
          </div>

          <button type="submit" disabled={submitting} className="w-full min-h-11 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Signing in…" : "Sign in"}</button>
        </form>

        <div className="mt-5 text-center text-sm text-muted-foreground">
          <a href="/resend-verification" className="text-primary hover:underline">Need a new verification email?</a>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">Don&apos;t have an account? <a href="/register" className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">Create one</a></p>
      </div>
    </div>
  );
}
