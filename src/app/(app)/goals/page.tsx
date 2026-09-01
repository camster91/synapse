"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import ResourceLoadError from "@/components/ResourceLoadError";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  level: string;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  parentId: string | null;
  children: Goal[];
  todos: { id: string; title: string; status: string }[];
}

const LEVEL_ORDER = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"];
const LEVEL_LABELS: Record<string, string> = { YEARLY: "Yearly", QUARTERLY: "Quarterly", MONTHLY: "Monthly", WEEKLY: "Weekly" };
const LEVEL_COLORS: Record<string, string> = {
  YEARLY: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400",
  QUARTERLY: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  MONTHLY: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  WEEKLY: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLevel, setNewLevel] = useState("QUARTERLY");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch("/api/goals");
      if (!response.ok) throw new Error("Goals request failed");
      const data = await response.json();
      setGoals(Array.isArray(data) ? data : (data.goals || []));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadGoals(); }, [loadGoals]);

  const addGoal = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, level: newLevel }),
      });
      if (!res.ok) throw new Error("Goal creation failed");
      const data = await res.json();
      setGoals([...goals, data]);
      setNewTitle("");
      setShowAdd(false);
    } catch {
      setCreateError("Unable to create goal. Your draft has been preserved.");
    } finally {
      setCreating(false);
    }
  };

  const updateProgress = async (goalId: string, progress: number) => {
    const prevGoals = goals;
    setGoals(goals.map((g) => (g.id === goalId ? { ...g, progress } : g)));
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress }),
      });
      if (!res.ok) throw new Error("Failed to update progress");
    } catch {
      setGoals(prevGoals);
      alert("Failed to update goal progress. Please try again.");
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const topLevelGoals = goals.filter((g) => !g.parentId);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (loadError) return <ResourceLoadError resource="goals" onRetry={loadGoals} />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Goals</h1>
          <p className="text-sm text-muted-foreground mt-1">Track what matters most</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {LEVEL_ORDER.map((level) => {
        const levelGoals = topLevelGoals.filter((g) => g.level === level);
        if (levelGoals.length === 0) return null;
        return (
          <div key={level} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {LEVEL_LABELS[level]} Goals
            </h2>
            {levelGoals.map((goal) => (
              <div key={goal.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {(goal.children?.length > 0 || goal.todos?.length > 0) && (
                        <button
                          onClick={() => toggleExpand(goal.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {expanded.has(goal.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      )}
                      <h3 className="font-medium text-foreground truncate">{goal.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_COLORS[goal.level] || "bg-muted text-muted-foreground"}`}>
                        {LEVEL_LABELS[goal.level] || goal.level}
                      </span>
                      {goal.status !== "ACTIVE" && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          goal.status === "COMPLETED"
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                            : goal.status === "ON_HOLD"
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                        }`}>
                          {goal.status.replace("_", " ").toLowerCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-muted-foreground ml-4">{goal.progress}%</span>
                  </div>
                  <div className="mt-2 relative">
                    <div className="w-full bg-xp-bar-bg rounded-full h-2">
                      <div className="bg-primary rounded-full h-2 transition-all duration-500" style={{ width: `${goal.progress}%` }} />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={goal.progress}
                      onChange={(e) => updateProgress(goal.id, parseInt(e.target.value))}
                      className="w-full opacity-0 absolute top-0 cursor-pointer"
                      style={{ height: "8px" }}
                    />
                  </div>
                </div>
                {expanded.has(goal.id) && goal.todos && goal.todos.length > 0 && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Linked Todos</p>
                    {goal.todos.map((todo) => (
                      <div key={todo.id} className="flex items-center gap-2 text-sm">
                        <span className={todo.status === "DONE" ? "text-emerald-500" : "text-muted-foreground"}>
                          {todo.status === "DONE" ? "\u2713" : "\u25CB"}
                        </span>
                        <span className={todo.status === "DONE" ? "line-through text-muted-foreground" : "text-foreground"}>
                          {todo.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {topLevelGoals.length === 0 && (
        <EmptyState
          title="No goals yet"
          description="Set your first goal to start tracking progress."
          action={{ label: "Add Goal", onClick: () => setShowAdd(true) }}
        />
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Goal">
        <div className="space-y-4">
          <div>
            <label htmlFor="new-goal-title" className="block text-sm font-medium text-foreground mb-1">What do you want to achieve?</label>
            <input
              id="new-goal-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGoal()}
              placeholder="e.g., Launch my side project"
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <fieldset>
            <legend className="block text-sm font-medium text-foreground mb-1">Timeframe</legend>
            <div className="flex gap-2">
              {LEVEL_ORDER.map((level) => (
                <button
                  type="button"
                  key={level}
                  onClick={() => setNewLevel(level)}
                  aria-pressed={newLevel === level}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    newLevel === level
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {LEVEL_LABELS[level]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2 pt-2">
            {createError && <p role="alert" className="mr-auto text-sm text-destructive">{createError}</p>}
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addGoal}
              disabled={!newTitle.trim() || creating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? "Creating..." : "Create Goal"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
