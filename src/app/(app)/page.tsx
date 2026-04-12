"use client";

import { useState, useEffect } from "react";
import {
  Target,
  CheckSquare,
  Calendar,
  Trophy,
  Flame,
  Zap,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import XpBar from "@/components/XpBar";

interface DashboardData {
  habits: { total: number; completed: number };
  todos: { id: string; title: string; priority: number; status: string; dueDate: string | null }[];
  events: { id: string; title: string; startAt: string; endAt: string | null }[];
  streak: number;
  xp: number;
  level: number;
  journal?: { content: string; mood: number | null; date: string } | null;
  inboxUnprocessed: number;
  userName?: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [quickCapture, setQuickCapture] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          setData(await res.json());
          return;
        }
      } catch {
        // fall through to defaults
      }
      setData({
        habits: { total: 0, completed: 0 },
        todos: [],
        events: [],
        streak: 0,
        xp: 0,
        level: 1,
        journal: null,
        inboxUnprocessed: 0,
      });
    }
    load();
  }, []);

  const handleQuickCapture = async () => {
    if (!quickCapture.trim()) return;
    await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: quickCapture.trim() }),
    });
    setQuickCapture("");
  };

  if (!data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-muted rounded-xl w-full max-w-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-xl" />
          ))}
        </div>
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
            <h2 className="text-sm font-semibold text-foreground">Active Todos</h2>
            <a href="/todos" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </a>
          </div>
          {data.todos.length > 0 ? (
            <div className="space-y-2">
              {data.todos.slice(0, 5).map((todo) => (
                <div key={todo.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="w-4 h-4 rounded border-2 border-muted-foreground/30 flex-shrink-0" />
                  <span className="text-sm text-foreground truncate">{todo.title}</span>
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
            <p className="text-sm text-muted-foreground">
              Set your goals to track progress.{" "}
              <a href="/goals" className="text-primary hover:underline">Get started</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}