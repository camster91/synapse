"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus,
  CheckSquare,
  FileText,
  Inbox,
  ChevronDown,
} from "lucide-react";

interface QuickAddProps {
  onAddTodo?: (title: string) => Promise<void>;
  onAddNote?: (title: string) => Promise<void>;
  onAddInbox?: (content: string) => Promise<void>;
}

type QuickAddType = "todo" | "note" | "inbox";

const addOptions: { type: QuickAddType; label: string; icon: typeof CheckSquare }[] = [
  { type: "todo", label: "New Todo", icon: CheckSquare },
  { type: "note", label: "New Note", icon: FileText },
  { type: "inbox", label: "New Inbox Item", icon: Inbox },
];

export default function QuickAdd({ onAddTodo, onAddNote, onAddInbox }: QuickAddProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [activeType, setActiveType] = useState<QuickAddType>("inbox");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async () => {
    if (!inputValue.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      switch (activeType) {
        case "todo":
          await onAddTodo?.(inputValue.trim());
          break;
        case "note":
          await onAddNote?.(inputValue.trim());
          break;
        case "inbox":
          await onAddInbox?.(inputValue.trim());
          break;
      }
      setInputValue("");
      setIsOpen(false);
    } catch {
      setError(`Unable to create ${activeType}. Your text has been preserved.`);
    } finally {
      setSubmitting(false);
    }
  };

  const activeOption = addOptions.find((o) => o.type === activeType)!;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Quick Add</span>
        <ChevronDown className="w-3 h-3 hidden sm:inline" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 animate-slide-up">
          <div className="p-3 border-b border-border">
            <div className="flex gap-1">
              {addOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.type}
                    onClick={() => setActiveType(option.type)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeType === option.type
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
                placeholder={`${activeOption.label}...`}
                className="flex-1 px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <button
                onClick={handleSubmit}
                disabled={!inputValue.trim() || submitting}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Adding..." : "Add"}
              </button>
            </div>
            {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
