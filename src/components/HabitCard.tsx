"use client";

import { useState } from "react";
import { Flame, Check, MoreHorizontal } from "lucide-react";

interface HabitCardProps {
  habit: {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    streak: number;
    completedToday: boolean;
    weeklyData: { date: string; completed: boolean }[];
  };
  onToggle: (id: string) => void;
}

export default function HabitCard({ habit, onToggle }: HabitCardProps) {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    onToggle(habit.id);
    setTimeout(() => setIsToggling(false), 300);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all group">
      <div className="flex items-start gap-3">
        {/* Toggle */}
        <button
          onClick={handleToggle}
          className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
            habit.completedToday
              ? "bg-primary border-primary text-primary-foreground scale-110"
              : "border-muted-foreground/30 hover:border-primary/50"
          } ${isToggling ? "scale-95" : ""}`}
        >
          {habit.completedToday && <Check className="w-3.5 h-3.5" />}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-medium ${habit.completedToday ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {habit.name}
            </h3>
            {habit.streak > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-orange-500 dark:text-orange-400">
                <Flame className="w-3 h-3" />
                {habit.streak}
              </span>
            )}
          </div>
          {habit.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{habit.description}</p>
          )}

          {/* Weekly dots */}
          <div className="flex items-center gap-1.5 mt-2">
            {habit.weeklyData.map((day) => (
              <div
                key={day.date}
                title={new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })}
                className={`w-2 h-2 rounded-full transition-colors ${
                  day.completed
                    ? "bg-primary"
                    : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <button className="p-1 rounded-lg text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}