"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Filter } from "lucide-react";
import TodoCard from "@/components/TodoCard";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import ResourceLoadError from "@/components/ResourceLoadError";

type TodoStatus = "INBOX" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED" | "SNOOZED";

interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: number;
  dueDate: string | null;
  parentId: string | null;
  subtasks: Todo[];
  tags: { id: string; name: string }[];
}

const COLUMNS: { status: TodoStatus; label: string }[] = [
  { status: "INBOX", label: "Inbox" },
  { status: "TODO", label: "Todo" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "DONE", label: "Done" },
];

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState(0);
  const [newStatus, setNewStatus] = useState<TodoStatus>("INBOX");
  const [filterPriority, setFilterPriority] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch("/api/todos");
      if (!response.ok) throw new Error("Todos request failed");
      const data = await response.json();
      setTodos(Array.isArray(data) ? data : (data.todos || []));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTodos(); }, [loadTodos]);

  const addTodo = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || undefined,
          priority: newPriority,
          status: newStatus,
        }),
      });
      if (!res.ok) throw new Error("Todo creation failed");
      const data = await res.json();
      setTodos([...todos, data]);
      setNewTitle("");
      setNewDesc("");
      setNewPriority(0);
      setShowAdd(false);
    } catch {
      setCreateError("Unable to create todo. Your draft has been preserved.");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const prevTodos = todos;
    setTodos(todos.map((t) => (t.id === id ? { ...t, status: status as TodoStatus } : t)));
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
    } catch {
      setTodos(prevTodos);
      alert("Failed to update todo status. Please try again.");
    }
  };

  const handleDelete = (id: string) => {
    const prevTodos = todos;
    setTodos(todos.filter((t) => t.id !== id));
    fetch(`/api/todos/${id}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to delete");
      })
      .catch(() => {
        setTodos(prevTodos);
        alert("Failed to delete todo. Please try again.");
      });
  };

  const filteredTodos = filterPriority !== null
    ? todos.filter((t) => t.priority === filterPriority)
    : todos;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-64 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (loadError) return <ResourceLoadError resource="todos" onRetry={loadTodos} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Todos</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize tasks, track progress</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-muted-foreground" />
            {[0, 1, 2, 3].map((p) => (
              <button
                key={p}
                onClick={() => setFilterPriority(filterPriority === p ? null : p)}
                className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                  filterPriority === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === 0 ? "-" : p}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Todo
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colTodos = filteredTodos.filter((t) => t.status === col.status && !t.parentId);
          return (
            <div key={col.status} className="flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${
                  col.status === "DONE" ? "bg-emerald-500" :
                  col.status === "IN_PROGRESS" ? "bg-amber-500" :
                  col.status === "TODO" ? "bg-blue-500" :
                  "bg-muted-foreground"
                }`} />
                <h2 className="text-sm font-semibold text-foreground">{col.label}</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{colTodos.length}</span>
              </div>
              <div className="space-y-2 flex-1 min-h-[200px]">
                {colTodos.length > 0 ? (
                  colTodos.map((todo) => (
                    <TodoCard
                      key={todo.id}
                      todo={todo}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                    />
                  ))
                ) : (
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                    <p className="text-xs text-muted-foreground">Drop tasks here</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {todos.length === 0 && (
        <EmptyState
          title="No todos yet"
          description="Add your first task to start getting organized."
          action={{ label: "Add Todo", onClick: () => setShowAdd(true) }}
        />
      )}

      {/* Add Todo Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Todo">
        <div className="space-y-4">
          <div>
            <label htmlFor="new-todo-title" className="block text-sm font-medium text-foreground mb-1">Title</label>
            <input
              id="new-todo-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="new-todo-description" className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
            <textarea
              id="new-todo-description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Add details..."
              rows={3}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="new-todo-priority" className="block text-sm font-medium text-foreground mb-1">Priority</label>
              <select
                id="new-todo-priority"
                value={newPriority}
                onChange={(e) => setNewPriority(Number(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={0}>None</option>
                <option value={1}>Low</option>
                <option value={2}>Medium</option>
                <option value={3}>High</option>
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="new-todo-status" className="block text-sm font-medium text-foreground mb-1">Status</label>
              <select
                id="new-todo-status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as TodoStatus)}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {COLUMNS.map((col) => (
                  <option key={col.status} value={col.status}>{col.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            {createError && <p role="alert" className="mr-auto text-sm text-destructive">{createError}</p>}
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addTodo}
              disabled={!newTitle.trim() || creating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? "Creating..." : "Create Todo"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
