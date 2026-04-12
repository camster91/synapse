"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Search, Bell, Plus, CheckSquare, FileText, Inbox } from "lucide-react";
import QuickAdd from "./QuickAdd";

interface HeaderProps {
  onSearch?: (query: string) => void;
  onAddTodo?: (title: string) => void;
  onAddNote?: (title: string) => void;
  onAddInbox?: (content: string) => void;
}

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/inbox": "Inbox",
  "/todos": "Todos",
  "/habits": "Habits",
  "/notes": "Notes",
  "/calendar": "Calendar",
  "/goals": "Goals",
  "/journal": "Journal",
  "/chat": "AI Chat",
  "/plugins": "Plugins",
  "/settings": "Settings",
  "/achievements": "Achievements",
};

export default function Header({
  onSearch,
  onAddTodo,
  onAddNote,
  onAddInbox,
}: HeaderProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const title =
    pageTitles[pathname] ||
    (pathname.startsWith("/notes/") ? "Note" : pathname.startsWith("/todos/") ? "Todo" : "Synapse");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 gap-4 flex-shrink-0">
      {/* Page Title */}
      <h1 className="text-lg font-semibold text-foreground hidden sm:block min-w-0 truncate">
        {title}
      </h1>

      {/* Search Bar */}
      <form
        onSubmit={handleSearch}
        className={`flex-1 max-w-md mx-auto transition-all duration-200 ${
          searchFocused ? "max-w-lg" : ""
        }`}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearch?.(e.target.value);
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search everything..."
            className="w-full pl-9 pr-4 py-1.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>
      </form>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <QuickAdd
          onAddTodo={onAddTodo}
          onAddNote={onAddNote}
          onAddInbox={onAddInbox}
        />

        <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}