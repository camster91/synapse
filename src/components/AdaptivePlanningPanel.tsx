"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, Undo2, X } from "lucide-react";
import type { PlanningAction, PlanningRecommendation } from "@/lib/adaptive-planning";

interface DisplayItem {
  id: string;
  title: string;
  goalTitle: string | null;
  dueDate: string | null;
  scheduledAt: string | null;
  estimatedMinutes: number | null;
  minimumMinutes: number | null;
}

interface PreviewResponse {
  proposal: {
    id: string;
    expiresAt: string;
    plan: {
      effectiveMinutes: number;
      recommendations: PlanningRecommendation[];
      noChange: boolean;
    };
  };
  confirmationToken: string;
  displayItems: DisplayItem[];
  timezone: string;
}

interface EffortDraft {
  estimatedMinutes: string;
  minimumMinutes: string;
}

const ACTION_ORDER: PlanningAction[] = ["keep", "shorten", "move", "drop"];
const ACTION_LABEL: Record<PlanningAction, string> = {
  keep: "Keep",
  shorten: "Shorten",
  move: "Move",
  drop: "Remove from Today",
};

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function readError(payload: unknown, fallback: string) {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = payload.error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback;
}

export default function AdaptivePlanningPanel({ onPlanChanged }: { onPlanChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [remainingMinutes, setRemainingMinutes] = useState(120);
  const [capacity, setCapacity] = useState<"low" | "normal" | "high">("normal");
  const [contextNote, setContextNote] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set<string>());
  const [effortDrafts, setEffortDrafts] = useState<Record<string, EffortDraft>>({});
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [savingEffortId, setSavingEffortId] = useState<string | null>(null);
  const [changeId, setChangeId] = useState<string | null>(null);
  const [undoExpiresAt, setUndoExpiresAt] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const busy = loading || applying || undoing || savingEffortId !== null;
  const closePanel = useCallback(() => setOpen(false), []);
  const invalidatePreview = useCallback(() => {
    setPreview(null);
    setSelected(new Set<string>());
    setChangeId(null);
    setUndoExpiresAt(null);
    setMessage(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    const focusable = () => Array.from(
      dialog?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    requestAnimationFrame(() => focusable()[0]?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      (previousFocus ?? triggerRef.current)?.focus();
    };
  }, [closePanel, open]);

  const itemById = useMemo(
    () => new Map((preview?.displayItems ?? []).map((item) => [item.id, item])),
    [preview],
  );

  const generatePreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setChangeId(null);
    setUndoExpiresAt(null);
    try {
      const response = await fetch("/api/adaptive-planning/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remainingMinutes, capacity }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readError(payload, "We could not revise your plan."));
      const next = payload as PreviewResponse;
      setPreview(next);
      setSelected(new Set<string>(
        next.proposal.plan.recommendations
          .filter((recommendation) => recommendation.action !== "keep")
          .map((recommendation) => recommendation.itemId),
      ));
      setEffortDrafts(Object.fromEntries(next.displayItems.map((item) => [
        item.id,
        {
          estimatedMinutes: item.estimatedMinutes?.toString() ?? "",
          minimumMinutes: item.minimumMinutes?.toString() ?? "",
        },
      ])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not revise your plan.");
    } finally {
      setLoading(false);
    }
  }, [capacity, remainingMinutes]);

  const saveEffort = async (itemId: string) => {
    const draft = effortDrafts[itemId] ?? { estimatedMinutes: "", minimumMinutes: "" };
    const estimate = draft.estimatedMinutes.trim() ? Number(draft.estimatedMinutes) : null;
    const minimum = draft.minimumMinutes.trim() ? Number(draft.minimumMinutes) : null;
    if ((estimate !== null && (!Number.isInteger(estimate) || estimate <= 0)) ||
        (minimum !== null && (!Number.isInteger(minimum) || minimum <= 0)) ||
        (minimum !== null && estimate === null) ||
        (estimate !== null && minimum !== null && minimum > estimate)) {
      setError("Use whole positive minutes, with the minimum no longer than the estimate.");
      return;
    }

    setSavingEffortId(itemId);
    setError(null);
    try {
      const response = await fetch(`/api/todos/${itemId}/effort`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatedMinutes: estimate, minimumMinutes: minimum }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readError(payload, "We could not save that effort estimate."));
      await generatePreview();
      setMessage("Effort saved and the proposal was refreshed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save that effort estimate.");
    } finally {
      setSavingEffortId(null);
    }
  };

  const applyPlan = async () => {
    if (!preview) return;
    setApplying(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/adaptive-planning/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationToken: preview.confirmationToken,
          selectedItemIds: [...selected],
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readError(payload, "We could not apply the revised plan."));
      const result = payload as { changeId: string | null; appliedCount: number; undoExpiresAt: string | null };
      setChangeId(result.changeId);
      setUndoExpiresAt(result.undoExpiresAt);
      setMessage(
        result.appliedCount > 0
          ? `Your plan was updated for ${result.appliedCount} ${result.appliedCount === 1 ? "item" : "items"}.`
          : "No changes were selected.",
      );
      onPlanChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not apply the revised plan.");
    } finally {
      setApplying(false);
    }
  };

  const undoPlan = async () => {
    if (!changeId) return;
    setUndoing(true);
    setError(null);
    try {
      const response = await fetch("/api/adaptive-planning/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeId }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readError(payload, "We could not undo that revision."));
      setChangeId(null);
      setUndoExpiresAt(null);
      setPreview(null);
      setSelected(new Set<string>());
      setMessage("The previous Today plan was restored.");
      onPlanChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not undo that revision.");
    } finally {
      setUndoing(false);
    }
  };

  const toggleSelected = (itemId: string) => {
    setSelected((current) => {
      const next = new Set<string>(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const formatTarget = (value: string | null | undefined) => {
    if (!value) return null;
    return new Date(value).toLocaleString(undefined, {
      timeZone: preview?.timezone,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="mx-auto flex max-w-6xl justify-end">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        My day changed
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div
            aria-hidden="true"
            onClick={() => { if (!busy) closePanel(); }}
            className="absolute inset-0 bg-black/50"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adaptive-planning-title"
            aria-describedby="adaptive-planning-description"
            className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card shadow-xl sm:max-w-2xl sm:rounded-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card px-4 py-4 sm:px-6">
              <div>
                <h2 id="adaptive-planning-title" className="text-lg font-semibold text-foreground">My day changed</h2>
                <p id="adaptive-planning-description" className="mt-1 text-sm text-muted-foreground">Revise what remains without treating the original plan as a failure.</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closePanel}
                disabled={busy}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5 p-4 sm:p-6">
              {!changeId && (
                <>
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold text-foreground">How much time remains before you are done today?</legend>
                    <div className="grid grid-cols-4 gap-2">
                      {[30, 60, 120, 240].map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          aria-pressed={remainingMinutes === minutes}
                          onClick={() => { setRemainingMinutes(minutes); invalidatePreview(); }}
                          className={`min-h-11 rounded-lg border px-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring ${remainingMinutes === minutes ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}
                        >
                          {formatMinutes(minutes)}
                        </button>
                      ))}
                    </div>
                    <label className="block text-sm text-muted-foreground" htmlFor="adaptive-custom-time">
                      Custom minutes
                    </label>
                    <input
                      id="adaptive-custom-time"
                      type="number"
                      min={0}
                      max={1440}
                      step={5}
                      value={remainingMinutes}
                      onChange={(event) => {
                        setRemainingMinutes(Math.max(0, Math.min(1440, Number(event.target.value) || 0)));
                        invalidatePreview();
                      }}
                      className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </fieldset>

                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold text-foreground">How are you operating right now?</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {(["low", "normal", "high"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={capacity === option}
                          onClick={() => { setCapacity(option); invalidatePreview(); }}
                          className={`min-h-11 rounded-lg border px-3 text-sm font-medium capitalize focus:outline-none focus:ring-2 focus:ring-ring ${capacity === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label htmlFor="adaptive-context" className="text-sm font-semibold text-foreground">What changed? <span className="font-normal text-muted-foreground">(optional)</span></label>
                    <textarea
                      id="adaptive-context"
                      rows={2}
                      maxLength={300}
                      value={contextNote}
                      onChange={(event) => setContextNote(event.target.value)}
                      placeholder="Unexpected meeting, interruption, fatigue…"
                      className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">This note stays in this dialog and is not stored or sent to the planner.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void generatePreview()}
                    disabled={busy}
                    className="min-h-11 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  >
                    {loading ? "Revising your day…" : preview ? "Regenerate proposal" : "Review a revised plan"}
                  </button>
                </>
              )}

              {preview && !changeId && (
                <div className="space-y-5 border-t border-border pt-5">
                  <div>
                    <h3 className="font-semibold text-foreground">Proposed revision</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Synapse found {formatMinutes(preview.proposal.plan.effectiveMinutes)} of reliable capacity after calendar constraints.
                    </p>
                  </div>

                  {preview.proposal.plan.noChange ? (
                    <div className="rounded-xl border border-border bg-background p-4 text-sm text-foreground">
                      Your current plan already fits the time and capacity you entered. Nothing needs to change.
                    </div>
                  ) : (
                    ACTION_ORDER.map((action) => {
                      const recommendations = preview.proposal.plan.recommendations.filter((item) => item.action === action);
                      if (recommendations.length === 0) return null;
                      return (
                        <section key={action} aria-labelledby={`adaptive-${action}-title`}>
                          <h4 id={`adaptive-${action}-title`} className="mb-2 text-sm font-semibold text-foreground">{ACTION_LABEL[action]}</h4>
                          <div className="space-y-2">
                            {recommendations.map((recommendation) => {
                              const item = itemById.get(recommendation.itemId);
                              const mutable = recommendation.action !== "keep";
                              const draft = effortDrafts[recommendation.itemId] ?? { estimatedMinutes: "", minimumMinutes: "" };
                              return (
                                <div key={recommendation.itemId} className="rounded-xl border border-border bg-background p-3">
                                  <div className="flex items-start gap-3">
                                    {mutable ? (
                                      <label className="flex min-h-11 min-w-11 cursor-pointer items-start justify-center pt-1">
                                        <input
                                          type="checkbox"
                                          checked={selected.has(recommendation.itemId)}
                                          onChange={() => toggleSelected(recommendation.itemId)}
                                          aria-label={`${selected.has(recommendation.itemId) ? "Exclude" : "Include"} ${item?.title ?? "task"} ${ACTION_LABEL[recommendation.action].toLowerCase()} recommendation`}
                                          className="h-5 w-5 rounded border-input"
                                        />
                                      </label>
                                    ) : (
                                      <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs text-primary" aria-hidden="true">✓</span>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-foreground">{item?.title ?? "Task"}</p>
                                      {item?.goalTitle && <p className="text-xs text-muted-foreground">For {item.goalTitle}</p>}
                                      <p className="mt-1 text-sm text-muted-foreground">{recommendation.explanation}</p>
                                      {recommendation.action === "shorten" && recommendation.targetEstimatedMinutes && (
                                        <p className="mt-1 text-xs font-medium text-foreground">Use {formatMinutes(recommendation.targetEstimatedMinutes)}</p>
                                      )}
                                      {recommendation.action === "move" && (
                                        <p className="mt-1 text-xs font-medium text-foreground">Move to {formatTarget(recommendation.targetScheduledAt)}</p>
                                      )}
                                      {recommendation.action === "drop" && (
                                        <p className="mt-1 text-xs font-medium text-foreground">Return after {formatTarget(recommendation.targetDeferredUntil)}</p>
                                      )}
                                    </div>
                                  </div>

                                  {item && (
                                    <details className="mt-3 border-t border-border pt-3">
                                      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">{item.estimatedMinutes === null ? "Add an effort estimate for better planning" : "Edit effort estimates"}</summary>
                                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <label className="text-sm text-foreground">
                                          Expected minutes
                                          <input
                                            type="number"
                                            min={1}
                                            max={10080}
                                            value={draft.estimatedMinutes}
                                            onChange={(event) => setEffortDrafts((current) => ({ ...current, [recommendation.itemId]: { ...draft, estimatedMinutes: event.target.value } }))}
                                            className="mt-1 min-h-11 w-full rounded-lg border border-input bg-card px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                                          />
                                        </label>
                                        <label className="text-sm text-foreground">
                                          Minimum viable minutes <span className="text-muted-foreground">(optional)</span>
                                          <input
                                            type="number"
                                            min={1}
                                            max={10080}
                                            value={draft.minimumMinutes}
                                            onChange={(event) => setEffortDrafts((current) => ({ ...current, [recommendation.itemId]: { ...draft, minimumMinutes: event.target.value } }))}
                                            className="mt-1 min-h-11 w-full rounded-lg border border-input bg-card px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                                          />
                                        </label>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => void saveEffort(recommendation.itemId)}
                                        disabled={busy}
                                        className="mt-3 min-h-11 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                                      >
                                        {savingEffortId === recommendation.itemId ? "Saving…" : "Save and refresh proposal"}
                                      </button>
                                    </details>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })
                  )}

                  {!preview.proposal.plan.noChange && (
                    <button
                      type="button"
                      onClick={() => void applyPlan()}
                      disabled={busy || selected.size === 0}
                      className="min-h-11 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      {applying ? "Applying revision…" : `Apply ${selected.size} selected ${selected.size === 1 ? "change" : "changes"}`}
                    </button>
                  )}
                </div>
              )}

              {changeId && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="font-semibold text-foreground">Your revised plan is active.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {undoExpiresAt
                      ? `Undo is available until ${formatTarget(undoExpiresAt)}, provided none of those tasks are edited again.`
                      : "Undo is available for a short period, provided none of those tasks are edited again."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void undoPlan()}
                    disabled={undoing}
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    {undoing ? "Undoing…" : "Undo revision"}
                  </button>
                </div>
              )}

              <div aria-live="polite" aria-atomic="true">
                {message && <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">{message}</p>}
                {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
