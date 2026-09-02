"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Calendar,
  Flag,
  Trash2,
} from "lucide-react";

interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  parentId: string | null;
  subtasks: Todo[];
  tags: { id: string; name: string }[];
}

interface TodoCardProps {
  todo: Todo;
  onStatusChange?: (id: string, status: string) => Promise<void> | void;
  onDelete?: (id: string) => void;
}

const priorityColors: Record<number, string> = {
  0: "text-muted-foreground",
  1: "text-blue-500",
  2: "text-warning",
  3: "text-destructive",
};

export default function TodoCard({ todo, onStatusChange, onDelete }: TodoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSubtasks = todo.subtasks && todo.subtasks.length > 0;

  const statusLabels: Record<string, string> = {
    INBOX: "Inbox",
    TODO: "Todo",
    IN_PROGRESS: "In Progress",
    DONE: "Done",
    CANCELLED: "Cancelled",
  };

  return (
    <div className="bg-card border border-border rounded-xl p-3 hover:shadow-sm transition-all group">
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <div className="mt-1 text-muted-foreground/30 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Checkbox */}
        <button
          onClick={() => onStatusChange?.(todo.id, todo.status === "DONE" ? "TODO" : "DONE")}
          className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            todo.status === "DONE"
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/30 hover:border-primary/50"
          }`}
        >
          {todo.status === "DONE" && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium truncate ${
              todo.status === "DONE" ? "text-muted-foreground line-through" : "text-foreground"
            }`}>
              {todo.title}
            </p>
            <Flag className={`w-3 h-3 flex-shrink-0 ${priorityColors[todo.priority] || "text-muted-foreground"}`} />
          </div>
          {todo.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{todo.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            {todo.dueDate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {new Date(todo.dueDate).toLocaleDateString()}
              </span>
            )}
            {hasSubtasks && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {todo.subtasks!.length} subtask{todo.subtasks!.length !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>

        {/* Status label */}
        <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
          todo.status === "DONE"
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
            : todo.status === "IN_PROGRESS"
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
              : "bg-muted text-muted-foreground"
        }`}>
          {statusLabels[todo.status] || todo.status}
        </span>

        {/* Delete */}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(todo.id); }}
            className="p-1 rounded-lg text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Subtasks */}
      {expanded && hasSubtasks && (
        <div className="ml-9 mt-2 space-y-1.5 border-l-2 border-border pl-3">
          {todo.subtasks!.map((subtask) => (
            <div key={subtask.id} className="flex items-center gap-2">
              <button
                onClick={() => onStatusChange?.(subtask.id, subtask.status === "DONE" ? "TODO" : "DONE")}
                className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  subtask.status === "DONE"
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/30"
                }`}
              >
                {subtask.status === "DONE" && (
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className={`text-sm ${subtask.status === "DONE" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                {subtask.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
