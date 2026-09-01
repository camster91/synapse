"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Grid3X3, List } from "lucide-react";
import Link from "next/link";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import ResourceLoadError from "@/components/ResourceLoadError";

interface Note {
  id: string;
  title: string;
  slug: string | null;
  icon: string | null;
  content: string;
  updatedAt: string;
  tags: { id: string; name: string }[];
  parentId: string | null;
  children: { id: string; title: string; icon: string | null }[];
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch("/api/notes");
      if (!response.ok) throw new Error("Notes request failed");
      const data = await response.json();
      setNotes(Array.isArray(data) ? data : (data.notes || []));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const addNote = async () => {
    if (!newTitle.trim()) return;
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, content: "" }),
    });
    if (res.ok) {
      const data = await res.json();
      window.location.href = `/notes/${data.id}`;
    }
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
  );
  const topLevelNotes = filteredNotes.filter((n) => !n.parentId);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (loadError) return <ResourceLoadError resource="notes" onRetry={loadNotes} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">Your knowledge base, connected</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </div>

      {/* Search & View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notes */}
      {topLevelNotes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Create your first note to start building your knowledge base."
          action={{ label: "New Note", onClick: () => setShowAdd(true) }}
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topLevelNotes.map((note) => (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-start gap-2 mb-2">
                <span className="text-lg">{note.icon || "📄"}</span>
                <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {note.title}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                {note.content.slice(0, 150) || "Empty note"}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {note.tags.map((tag) => (
                    <span key={tag.id} className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                      {tag.name}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </span>
              </div>
              {note.children && note.children.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {note.children.length} sub-page{note.children.length !== 1 ? "s" : ""}
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {topLevelNotes.map((note) => (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <span className="text-lg">{note.icon || "📄"}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {note.title}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {note.content.slice(0, 100) || "Empty note"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(note.updatedAt).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Add Note Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Note">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              placeholder="Note title..."
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addNote}
              disabled={!newTitle.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create Note
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
