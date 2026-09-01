"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

type SearchItem = {
  id: string;
  title?: string;
  content?: string;
  date?: string;
};

type SearchResponse = {
  todos: SearchItem[];
  notes: SearchItem[];
  journals: SearchItem[];
  goals: SearchItem[];
  events: SearchItem[];
  habits: SearchItem[];
  inboxItems: SearchItem[];
  conversations: SearchItem[];
};

const groups: Array<{ key: keyof SearchResponse; label: string; href: (item: SearchItem) => string }> = [
  { key: "todos", label: "Todos", href: () => "/todos" },
  { key: "notes", label: "Notes", href: (item) => `/notes/${item.id}` },
  { key: "journals", label: "Journal", href: () => "/journal" },
  { key: "goals", label: "Goals", href: () => "/goals" },
  { key: "events", label: "Calendar", href: () => "/calendar" },
  { key: "habits", label: "Habits", href: () => "/habits" },
  { key: "inboxItems", label: "Inbox", href: () => "/inbox" },
  { key: "conversations", label: "AI conversations", href: (item) => `/chat?conversation=${encodeURIComponent(item.id)}` },
];

export default function GlobalSearchResults({
  query,
  onQueryChange,
  onClose,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
}) {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search request failed");
        setResults(await response.json());
      } catch (requestError) {
        if ((requestError as Error).name !== "AbortError") {
          setError(true);
          setResults(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const count = useMemo(
    () => (results ? groups.reduce((total, group) => total + results[group.key].length, 0) : 0),
    [results]
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 px-4 pt-20" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-search-title"
        className="max-h-[70vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center gap-3 border-b border-border bg-card p-4">
          <div className="min-w-0 flex-1">
            <h2 id="global-search-title" className="sr-only">Search everything</h2>
            <label htmlFor="global-search-input" className="sr-only">Search todos, notes, journal, goals, and calendar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="global-search-input"
                autoFocus
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close search results" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <p role="status" className="py-10 text-center text-sm text-muted-foreground">Searching...</p>
          ) : error ? (
            <div role="alert" className="py-10 text-center">
              <p className="font-medium text-foreground">Search could not be completed</p>
              <p className="mt-1 text-sm text-muted-foreground">Your data is unchanged. Edit the query or try again.</p>
            </div>
          ) : count === 0 ? (
            <div className="py-10 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium text-foreground">No matching items</p>
              <p className="mt-1 text-sm text-muted-foreground">Try a different word or phrase.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => {
                const items = results?.[group.key] ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={group.key}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                    <div className="space-y-1">
                      {items.map((item) => (
                        <Link key={`${group.key}-${item.id}`} href={group.href(item)} onClick={onClose} className="block rounded-lg border border-border p-3 hover:bg-muted">
                          <span className="font-medium text-foreground">{item.title || item.date || "Journal entry"}</span>
                          {item.content && <span className="mt-1 block truncate text-sm text-muted-foreground">{item.content}</span>}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
