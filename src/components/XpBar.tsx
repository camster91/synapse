"use client";

interface XpBarProps {
  currentXp: number;
  level: number;
  xpPerLevel?: number;
  showLabel?: boolean;
  compact?: boolean;
}

export default function XpBar({
  currentXp,
  level,
  xpPerLevel = 100,
  showLabel = true,
  compact = false,
}: XpBarProps) {
  const xpInLevel = currentXp % xpPerLevel;
  const progress = (xpInLevel / xpPerLevel) * 100;
  const xpToNext = xpPerLevel - xpInLevel;

  return (
    <div className={compact ? "w-full" : "w-full space-y-1"}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            Level {level}
          </span>
          {!compact && (
            <span className="text-muted-foreground">
              {xpInLevel}/{xpPerLevel} XP
            </span>
          )}
        </div>
      )}
      <div className="w-full h-2 bg-xp-bar-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-xp-bar rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      {!compact && (
        <p className="text-[10px] text-muted-foreground">
          {xpToNext} XP to level {level + 1}
        </p>
      )}
    </div>
  );
}