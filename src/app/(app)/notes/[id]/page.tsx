"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Eye, Edit2, Link2 } from "lucide-react";
import Link from "next/link";

interface Note {
  id: string;
  title: string;
  content: string;
  icon: string | null;
  slug: string | null;
  parentId: string | null;
  updatedAt: string;
  backlinks: { fromNoteId: string; fromNote: { id: string; title: string } }[];
  linkedBy: { toNoteId: string; toNote: { id: string; title: string } }[];
  children?: { id: string; title: string; icon: string | null }[];
}

export default function NoteEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch(`/api/notes/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load note");
        return r.json();
      })
      .then((data) => {
        setNote(data);
        setTitle(data.title);
        setContent(data.content);
      })
      .catch(() => {
        setLoadError(true);
      });
  }, [id]);

  const saveNote = async () => {
    if (!note) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) throw new Error("Failed to save note");
    } catch {
      alert("Failed to save note. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleBlur = () => {
    if (title !== note?.title || content !== note?.content) {
      saveNote();
    }
  };

  // Simple markdown rendering (sanitized against XSS)
  const sanitize = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const renderMarkdown = (text: string) => {
    const safe = sanitize(text);
    return safe
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold text-foreground mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold text-foreground mt-6 mb-2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-foreground mt-8 mb-3">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\[\[(.*?)\]\]/g, '<a class="text-primary hover:underline cursor-pointer">[[$1]]</a>')
      .replace(/^- (.*$)/gm, '<li class="ml-4 text-foreground">$1</li>')
      .replace(/^&gt; (.*$)/gm, '<blockquote class="border-l-2 border-primary pl-4 text-muted-foreground italic">$1</blockquote>')
      .replace(/\n/g, "<br />");
  };

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <h2 className="text-lg font-semibold text-foreground">Failed to load note</h2>
        <p className="text-sm text-muted-foreground">The note could not be found or loaded. Please try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Reload
        </button>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-96 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => router.push("/notes")}
          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Notes
        </button>
        {note.parentId && (
          <Link href={`/notes/${note.parentId}`} className="text-muted-foreground hover:text-foreground transition-colors">
            / Parent
          </Link>
        )}
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground font-medium truncate">{note.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-2xl">{note.icon || "📄"}</span>
          {editMode ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleBlur}
              className="text-xl font-bold text-foreground bg-transparent border-none outline-none flex-1 min-w-0"
              placeholder="Untitled"
            />
          ) : (
            <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(!editMode)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={editMode ? "Preview" : "Edit"}
          >
            {editMode ? <Eye className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          </button>
          <button
            onClick={saveNote}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      {editMode ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          placeholder="Start writing... Use [[double brackets]] to link to other notes."
          className="w-full min-h-[60vh] px-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono leading-relaxed"
        />
      ) : (
        <div
          className="prose-editor min-h-[60vh] px-4 py-3 bg-card border border-border rounded-xl"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}

      {/* Sub-pages */}
      {note.children && note.children.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Sub-pages</h3>
          <div className="space-y-1">
            {note.children.map((child) => (
              <button
                key={child.id}
                onClick={() => router.push(`/notes/${child.id}`)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted/50 transition-colors text-left"
              >
                <span>{child.icon || "📄"}</span>
                <span className="truncate">{child.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Backlinks */}
      {((note.backlinks && note.backlinks.length > 0) || (note.linkedBy && note.linkedBy.length > 0)) && (
        <div className="bg-card border border-border rounded-xl p-4">
          <button
            onClick={() => setShowBacklinks(!showBacklinks)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Link2 className="w-4 h-4" />
            Backlinks ({(note.backlinks?.length || 0) + (note.linkedBy?.length || 0)})
          </button>
          {showBacklinks && (
            <div className="mt-2 space-y-1">
              {note.backlinks?.map((bl) => (
                <Link key={bl.fromNoteId} href={`/notes/${bl.fromNoteId}`} className="block text-sm text-primary hover:underline">
                  {bl.fromNote.title}
                </Link>
              ))}
              {note.linkedBy?.map((bl) => (
                <Link key={bl.toNoteId} href={`/notes/${bl.toNoteId}`} className="block text-sm text-primary hover:underline">
                  {bl.toNote.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted-foreground">
        Last edited {new Date(note.updatedAt).toLocaleString()}
      </div>
    </div>
  );
}