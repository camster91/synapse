"use client";

import { useState, useEffect } from "react";
import {
  Target,
  CheckSquare,
  Flame,
  Zap,
  ArrowRight,
  Check,
} from "lucide-react";
import XpBar from "@/components/XpBar";

interface DashboardHabit {
  id: string;
  name: string;
  targetCount: number;
  logs: { count: number }[];
}

interface DashboardData {
  habits: { total: number; completed: number; items: DashboardHabit[] };
  todos: { id: string; title: string; priority: number; status: string; dueDate: string | null; goal: { id: string; title: string } | null }[];
  events: { id: string; title: string; startAt: string; endAt: string | null }[];
  goals: { id: string; title: string; level: string; progress: number }[];
  streak: number;
  xp: number;
  level: number;
  journal?: { content: string; mood: number | null; date: string } | null;
  inboxUnprocessed: number;
  userName?: string;
}

function normalizeDashboard(raw: Record<string, unknown>): DashboardData {
  const user = (raw.user ?? {}) as Record<string, unknown>;
  const habits = (raw.habits ?? {}) as Record<string, unknown>;
  return {
    habits: {
      total: (habits.total as number) ?? 0,
      completed: (habits.completed as number) ?? 0,
      items: (habits.items ?? []) as DashboardHabit[],
    },
    todos: (raw.todos ?? []) as DashboardData["todos"],
    events: (raw.events ?? []) as DashboardData["events"],
    goals: (raw.goals ?? []) as DashboardData["goals"],
    streak: (user.streakDays as number) ?? (raw.streak as number) ?? 0,
    xp: (user.xp as number) ?? (raw.xp as number) ?? 0,
    level: (user.level as number) ?? (raw.level as number) ?? 1,
    journal: (raw.recentJournal ?? raw.journal ?? null) as DashboardData["journal"],
    inboxUnprocessed: (raw.unprocessedInbox as number) ?? (raw.inboxUnprocessed as number) ?? 0,
    userName: (user.name as string) ?? (raw.userName as string) ?? undefined,
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickCapture, setQuickCapture] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const raw = await res.json();
          setData(normalizeDashboard(raw));
        } else if (res.status === 401) {
          setError("Please sign in to view your dashboard.");
        } else {
          setError("Failed to load dashboard data. Please try again.");
        }
      } catch {
        setError("Network error. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleQuickCapture = async () => {
    if (!quickCapture.trim()) return;
    const prevCapture = quickCapture;
    setQuickCapture("");
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: prevCapture.trim() }),
      });
      if (!res.ok) throw new Error("Failed to capture");
    } catch {
      setQuickCapture(prevCapture);
      alert("Failed to capture. Please try again.");
    }
  };

  const completeTodo = async (todoId: string) => {
    if (!data) return;
    const previous = data;
    setActionError(null);
    setData({ ...data, todos: data.todos.filter((todo) => todo.id !== todoId) });
    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      if (!response.ok) throw new Error("Task completion failed");
    } catch {
      setData(previous);
      setActionError("We could not complete that task. Your Today view was restored.");
    }
  };

  const completeHabit = async (habitId: string) => {
    if (!data) return;
    const habit = data.habits.items.find((item) => item.id === habitId);
    if (!habit || habit.logs.some((log) => log.count >= habit.targetCount)) return;
    const previous = data;
    setActionError(null);
    setData({
      ...data,
      habits: {
        ...data.habits,
        completed: data.habits.completed + 1,
        items: data.habits.items.map((item) =>
          item.id === habitId ? { ...item, logs: [{ count: item.targetCount }] } : item
        ),
      },
    });
    try {
      const response = await fetch(`/api/habits/${habitId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: habit.targetCount }),
      });
      if (!response.ok) throw new Error("Habit completion failed");
    } catch {
      setData(previous);
      setActionError("We could not complete that habit. Your Today view was restored.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-muted rounded-xl w-full max-w-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-48 bg-muted rounded-xl animate-pulse" />
          <div className="h-48 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <Zap className="w-6 h-6 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Zap className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Welcome to Synapse</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Start capturing thoughts, tracking habits, and building your second brain.
        </p>
      </div>
    );
  }

  const habitPercent = data.habits.total > 0 ? Math.round((data.habits.completed / data.habits.total) * 100) : 0;
  const moodEmojis = ["😢", "😕", "😐", "🙂", "😊"];
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (habitPercent / 100) * circumference;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Quick Capture */}
      <div className="flex gap-3">
        <input
          type="text"
          value={quickCapture}
          onChange={(e) => setQuickCapture(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuickCapture()}
          placeholder="Capture a thought, task, or idea..."
          className="flex-1 px-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
        />
        <button
          onClick={handleQuickCapture}
          disabled={!quickCapture.trim()}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Capture
        </button>
      </div>

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back{data.userName ? `, ${data.userName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Habit Ring */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-foreground">Habits</span>
            </div>
            <span className="text-xs text-muted-foreground">{data.habits.completed}/{data.habits.total}</span>
          </div>
          <div className="relative w-20 h-20 mx-auto">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="var(--xp-bar-bg)" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke="var(--success)" strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-foreground">
              {habitPercent}%
            </span>
          </div>
        </div>

        {/* Streak */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-sm font-medium text-foreground">Streak</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{data.streak}</p>
          <p className="text-xs text-muted-foreground">day{data.streak !== 1 ? "s" : ""} in a row</p>
        </div>

        {/* Active Todos */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-medium text-foreground">Todos</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{data.todos.length}</p>
          <p className="text-xs text-muted-foreground">active tasks</p>
        </div>

        {/* XP Progress */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">Level {data.level}</span>
          </div>
          <XpBar currentXp={data.xp} level={data.level} />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active Todos */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Today&apos;s priorities</h2>
            <a href="/todos" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </a>
          </div>
          {data.todos.length > 0 ? (
            <div className="space-y-2">
              {data.todos.slice(0, 5).map((todo) => (
                <div key={todo.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <button type="button" aria-label={`Complete ${todo.title}`} onClick={() => void completeTodo(todo.id)} className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 border-muted-foreground/30 hover:border-primary hover:text-primary">
                    <Check className="h-3 w-3 opacity-0 hover:opacity-100" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{todo.title}</span>
                    {todo.goal && <span className="block truncate text-xs text-muted-foreground">For {todo.goal.title}</span>}
                  </div>
                  {todo.dueDate && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(todo.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No active todos. <a href="/todos" className="text-primary hover:underline">Add one</a> to get started!
            </p>
          )}
          {data.habits.items.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Daily practices</h3>
                <a href="/habits" className="text-xs text-primary hover:underline">Manage habits</a>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.habits.items.map((habit) => {
                  const complete = habit.logs.some((log) => log.count >= habit.targetCount);
                  return (
                    <button key={habit.id} type="button" disabled={complete} onClick={() => void completeHabit(habit.id)} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${complete ? "border-primary/20 bg-primary/5 text-muted-foreground" : "border-border hover:border-primary/40 hover:bg-muted/50"}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded border-2 ${complete ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}`}>
                        {complete && <Check className="h-3 w-3" />}
                      </span>
                      <span className={complete ? "line-through" : "text-foreground"}>{habit.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {actionError && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionError}</p>}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Events */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Today&apos;s Schedule</h2>
              <a href="/calendar" className="text-xs text-primary hover:underline flex items-center gap-1">
                Calendar <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            {data.events.length > 0 ? (
              <div className="space-y-2">
                {data.events.map((event) => (
                  <div key={event.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-1.5 h-8 rounded-full bg-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No events today</p>
            )}
          </div>

          {/* Journal */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Journal</h2>
              <a href="/journal" className="text-xs text-primary hover:underline flex items-center gap-1">
                Write <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            {data.journal ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{data.journal.mood !== null ? moodEmojis[data.journal.mood - 1] : "✍️"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(data.journal.date).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-foreground/80 line-clamp-3">{data.journal.content.slice(0, 150)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Start writing today&apos;s entry
              </p>
            )}
          </div>

          {/* Goals */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-foreground">Goals</h2>
              <a href="/goals" className="text-xs text-primary hover:underline flex items-center gap-1">
                View <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            {data.goals.length > 0 ? (
              <div className="space-y-3">
                {data.goals.map((goal) => (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-foreground">{goal.title}</span>
                      <span className="text-muted-foreground">{goal.progress}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${goal.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Set a goal to connect today&apos;s actions to a larger outcome.{" "}
                <a href="/goals" className="text-primary hover:underline">Get started</a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
