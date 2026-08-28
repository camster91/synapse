"use client";

import { useState, useEffect } from "react";
import { Check, Trash2, FileText, ListTodo } from "lucide-react";
import EmptyState from "@/components/EmptyState";

interface InboxItem {
  id: string;
  content: string;
  source: string;
  type: string;
  processed: boolean;
  createdAt: string;
}

const sourceLabels: Record<string, string> = {
  MANUAL: "Manual",
  AI_CHAT: "AI Chat",
  EMAIL: "Email",
  WEB_CLIPPER: "Web Clipper",
  PLUGIN: "Plugin",
};

const typeLabels: Record<string, string> = {
  THOUGHT: "Thought",
  LINK: "Link",
  IMAGE: "Image",
  TASK: "Task",
  NOTE: "Note",
};

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unprocessed">("unprocessed");

  useEffect(() => {
    fetch("/api/inbox")
      .then((r) => r.json())
      .then((data) => setItems(data.items || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const deleteItem = async (id: string) => {
    const prevItems = items;
    setItems(items.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/inbox/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete item");
    } catch {
      setItems(prevItems);
      alert("Failed to delete inbox item. Please try again.");
    }
  };

  const triageItem = async (id: string, destination: "todo" | "note" | "archive") => {
    const prevItems = items;
    setItems(items.map((item) => item.id === id ? { ...item, processed: true } : item));
    try {
      const res = await fetch(`/api/inbox/${id}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination }),
      });
      if (!res.ok) throw new Error("Failed to triage item");
    } catch {
      setItems(prevItems);
      alert("Failed to triage inbox item. Please try again.");
    }
  };

  const filteredItems = filter === "unprocessed"
    ? items.filter((i) => !i.processed)
    : items;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Turn each capture into a task, note, or archive it when you are done.
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setFilter("unprocessed")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === "unprocessed" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Unprocessed
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-card border border-border rounded-xl p-4 transition-all ${
                item.processed ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${item.processed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {item.content}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                      {typeLabels[item.type] || item.type}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                      {sourceLabels[item.source] || item.source}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!item.processed && (
                    <>
                      <button onClick={() => triageItem(item.id, "todo")} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors" title="Turn into task"><ListTodo className="w-4 h-4" /></button>
                      <button onClick={() => triageItem(item.id, "note")} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors" title="Save as note"><FileText className="w-4 h-4" /></button>
                      <button onClick={() => triageItem(item.id, "archive")} className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" title="Archive"><Check className="w-4 h-4" /></button>
                    </>
                  )}
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title={filter === "unprocessed" ? "Inbox zero!" : "No items"}
          description={
            filter === "unprocessed"
              ? "All your items have been processed. Great job!"
              : "Your inbox is empty. Capture thoughts, links, and ideas using the quick add button."
          }
        />
      )}
    </div>
  );
}
