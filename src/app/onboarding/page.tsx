"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { postAuthenticationPath } from "@/lib/routes";

export default function OnboardingPage() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [habit, setHabit] = useState("");
  const [task, setTask] = useState("");
  const [productAnalyticsConsent, setProductAnalyticsConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/onboarding")
      .then(async (response) => {
        if (!response.ok) throw new Error("Setup status is unavailable");
        const data = await response.json();
        if (data.complete) router.replace(postAuthenticationPath());
      })
      .catch(() => setError("We could not load setup. Please retry."))
      .finally(() => setChecking(false));
  }, [router]);

  async function complete(skip = false) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skip, goal, habit, task, productAnalyticsConsent }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error === "Validation failed" ? "Add one priority task or skip setup." : data.error);
      }
      router.push(postAuthenticationPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup could not be saved. Please retry.");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center bg-background px-4">
        <p className="text-sm text-muted-foreground" role="status">Loading your setup…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">S</div>
          <p className="text-sm font-medium text-primary">A focused start</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">Build today from what matters</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Add one outcome, one repeatable practice, and the next concrete action. You can change everything later.
          </p>
        </div>

        <form
          className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-8"
          onSubmit={(event) => {
            event.preventDefault();
            void complete(false);
          }}
        >
          <div>
            <label htmlFor="onboarding-goal" className="block text-sm font-semibold text-foreground">What outcome matters this season? <span className="font-normal text-muted-foreground">Optional</span></label>
            <p className="mb-2 mt-1 text-xs text-muted-foreground">A result you want over the next few months.</p>
            <input id="onboarding-goal" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} placeholder="Ship my portfolio and find three strong clients" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <input
              type="checkbox"
              checked={productAnalyticsConsent}
              onChange={(event) => setProductAnalyticsConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">Help improve the private beta</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Store three fixed activity signals in this Synapse instance: first plan created, Today opened, and export succeeded. No task content, page history, device data, or third-party analytics. Optional and reversible in Settings.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="onboarding-habit" className="block text-sm font-semibold text-foreground">What small practice would support it? <span className="font-normal text-muted-foreground">Optional</span></label>
            <p className="mb-2 mt-1 text-xs text-muted-foreground">Something realistic enough to repeat daily.</p>
            <input id="onboarding-habit" value={habit} onChange={(event) => setHabit(event.target.value)} maxLength={200} placeholder="Twenty focused minutes before checking messages" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div>
            <label htmlFor="onboarding-task" className="block text-sm font-semibold text-foreground">What is the next concrete action?</label>
            <p className="mb-2 mt-1 text-xs text-muted-foreground">This becomes your first high-priority task on Today.</p>
            <input id="onboarding-task" required value={task} onChange={(event) => setTask(event.target.value)} maxLength={500} placeholder="Draft the portfolio homepage outline" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}

          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" />
            {loading ? "Building your Today view…" : "Build my Today view"}
          </button>
          <button type="button" disabled={loading} onClick={() => void complete(true)} className="w-full rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">Skip setup for now</button>
        </form>

        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Your setup stays in your Synapse instance.
        </p>
      </div>
    </main>
  );
}
