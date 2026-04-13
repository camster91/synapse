"use client";

import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";

export default function JournalPage() {
  const [entries, setEntries] = useState<
    { id: string; date: string; content: string; mood: number | null; gratitude: string | null; highlights: string | null }[]
  >([]);
  const [todayContent, setTodayContent] = useState("");
  const [todayMood, setTodayMood] = useState<number | null>(null);
  const [todayGratitude, setTodayGratitude] = useState("");
  const [todayHighlights, setTodayHighlights] = useState("");
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetch("/api/journal")
      .then((r) => r.json())
      .then((data) => {
        const journals = Array.isArray(data) ? data : (data.journals || []);
        setEntries(journals);
        const todayEntry = journals.find((j: { date: string }) => j.date.startsWith(today));
        if (todayEntry) {
          setTodayContent(todayEntry.content || "");
          setTodayMood(todayEntry.mood);
          setTodayGratitude(todayEntry.gratitude || "");
          setTodayHighlights(todayEntry.highlights || "");
        }
      })
      .catch(() => {});
  }, []);

  const saveEntry = async () => {
    setSaving(true);
    await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: today,
        content: todayContent,
        mood: todayMood,
        gratitude: todayGratitude,
        highlights: todayHighlights,
      }),
    });
    setSaving(false);
  };

  const moodEmojis = ["😢", "😕", "😐", "🙂", "😊"];
  const moodLabels = ["Awful", "Bad", "Okay", "Good", "Great"];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* Today's Entry */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-foreground">Today&apos;s Entry</h2>

        {/* Mood Selector */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">How are you feeling?</label>
          <div className="flex gap-3">
            {moodEmojis.map((emoji, i) => (
              <button
                key={i}
                onClick={() => setTodayMood(i + 1)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                  todayMood === i + 1
                    ? "bg-primary/10 border-2 border-primary"
                    : "bg-muted border-2 border-transparent hover:border-border"
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className="text-xs text-muted-foreground">{moodLabels[i]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">What&apos;s on your mind?</label>
          <textarea
            value={todayContent}
            onChange={(e) => setTodayContent(e.target.value)}
            placeholder="Write your thoughts..."
            rows={6}
            className="w-full px-4 py-3 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Gratitude */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Gratitude</label>
          <input
            type="text"
            value={todayGratitude}
            onChange={(e) => setTodayGratitude(e.target.value)}
            placeholder="What are you grateful for today?"
            className="w-full px-4 py-3 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Highlights */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Highlights</label>
          <textarea
            value={todayHighlights}
            onChange={(e) => setTodayHighlights(e.target.value)}
            placeholder="Key moments from today..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <button
          onClick={saveEntry}
          disabled={saving}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Entry"}
        </button>
      </div>

      {/* Previous Entries */}
      {entries.filter((e) => !e.date.startsWith(today)).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Previous Entries</h2>
          {entries
            .filter((e) => !e.date.startsWith(today))
            .map((entry) => (
              <div key={entry.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  {entry.mood && <span className="text-xl">{moodEmojis[entry.mood - 1]}</span>}
                </div>
                <p className="text-sm text-foreground line-clamp-3">{entry.content}</p>
                {entry.gratitude && (
                  <p className="text-xs text-muted-foreground mt-2 italic">Grateful: {entry.gratitude}</p>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}