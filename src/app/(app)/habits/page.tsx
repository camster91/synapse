"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import HabitCard from "@/components/HabitCard";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import ResourceLoadError from "@/components/ResourceLoadError";

interface Habit {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  frequency: string;
  targetCount: number;
  archived: boolean;
  logs: { date: string; count: number }[];
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFrequency, setNewFrequency] = useState("DAILY");
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadHabits = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch("/api/habits");
      if (!response.ok) throw new Error("Habits request failed");
      const data = await response.json();
      setHabits(Array.isArray(data) ? data : (data.habits || []));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadHabits(); }, [loadHabits]);

  const addHabit = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc || undefined, frequency: newFrequency }),
      });
      if (!res.ok) throw new Error("Habit creation failed");
      const data = await res.json();
      setHabits([...habits, { ...data, logs: data.logs || [] }]);
      setNewName("");
      setNewDesc("");
      setShowAdd(false);
    } catch {
      setCreateError("Unable to create habit. Your draft has been preserved.");
    } finally {
      setCreating(false);
    }
  };

  const toggleHabit = async (habitId: string) => {
    const prevHabits = habits;
    const today = new Date().toISOString().split("T")[0];
    setHabits(
      habits.map((h) => {
        if (h.id === habitId) {
          const hasToday = h.logs.some((l) => l.date.startsWith(today));
          return {
            ...h,
            logs: hasToday
              ? h.logs.filter((l) => !l.date.startsWith(today))
              : [...h.logs, { date: today, count: 1 }],
          };
        }
        return h;
      })
    );
    try {
      const res = await fetch(`/api/habits/${habitId}/log`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to toggle habit");
    } catch {
      setHabits(prevHabits);
      alert("Failed to toggle habit. Please try again.");
    }
  };

  const getStreak = (habit: Habit) => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      if (habit.logs.some((l) => l.date.startsWith(dateStr))) {
        streak++;
      } else if (i > 0) break;
    }
    return streak;
  };

  const getWeeklyData = (habit: Habit) => {
    const result = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      result.push({
        date: dateStr,
        completed: habit.logs.some((l) => l.date.startsWith(dateStr)),
      });
    }
    return result;
  };

  const today = new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (loadError) return <ResourceLoadError resource="habits" onRetry={loadHabits} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Habits</h1>
          <p className="text-sm text-muted-foreground mt-1">Build consistency, one day at a time</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Habit
        </button>
      </div>

      {habits.length > 0 ? (
        <div className="space-y-3">
          {habits.map((habit) => {
            const isCompleted = habit.logs.some((l) => l.date.startsWith(today));
            const streak = getStreak(habit);
            const weeklyData = getWeeklyData(habit);

            return (
              <HabitCard
                key={habit.id}
                habit={{
                  id: habit.id,
                  name: habit.name,
                  description: habit.description || undefined,
                  icon: habit.icon || undefined,
                  color: habit.color || undefined,
                  streak,
                  completedToday: isCompleted,
                  weeklyData,
                }}
                onToggle={toggleHabit}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No habits yet"
          description="Start building positive routines by creating your first habit."
          action={{ label: "Add Habit", onClick: () => setShowAdd(true) }}
        />
      )}

      {/* Add Habit Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Habit">
        <div className="space-y-4">
          <div>
            <label htmlFor="new-habit-name" className="block text-sm font-medium text-foreground mb-1">Name</label>
            <input
              id="new-habit-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Read for 30 minutes"
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="new-habit-description" className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
            <input
              id="new-habit-description"
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="What this habit means to you"
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <fieldset>
            <legend className="block text-sm font-medium text-foreground mb-1">Frequency</legend>
            <div className="flex gap-2">
              {["DAILY", "WEEKLY"].map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setNewFrequency(f)}
                  aria-pressed={newFrequency === f}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    newFrequency === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.charAt(0) + f.slice(1).toLowerCase()}
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
              onClick={addHabit}
              disabled={!newName.trim() || creating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? "Creating..." : "Create Habit"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
