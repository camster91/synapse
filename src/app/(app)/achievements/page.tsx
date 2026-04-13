"use client";

import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import EmptyState from "@/components/EmptyState";

interface Achievement {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  earned: boolean;
  earnedAt: string | null;
}

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gamification/achievements")
      .then((r) => r.json())
      .then((data) => setAchievements(Array.isArray(data) ? data : (data.achievements || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = [...new Set(achievements.map((a) => a.category))];
  const earnedCount = achievements.filter((a) => a.earned).length;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Achievements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {earnedCount} of {achievements.length} unlocked
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
          <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{earnedCount} earned</span>
        </div>
      </div>

      {categories.map((category) => (
        <div key={category}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {achievements
              .filter((a) => a.category === category)
              .map((achievement) => (
                <div
                  key={achievement.key}
                  className={`p-4 rounded-xl border transition-all ${
                    achievement.earned
                      ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
                      : "border-border bg-card opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl ${achievement.earned ? "" : "grayscale opacity-50"}`}>
                      {achievement.icon}
                    </span>
                    <div className="min-w-0">
                      <h3 className={`font-medium truncate ${
                        achievement.earned ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {achievement.name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">{achievement.description}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-primary">+{achievement.xpReward} XP</span>
                    {achievement.earned && achievement.earnedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(achievement.earnedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}

      {achievements.length === 0 && (
        <EmptyState
          title="No achievements yet"
          description="Achievements will unlock as you use Synapse. Keep building habits and completing tasks!"
        />
      )}
    </div>
  );
}