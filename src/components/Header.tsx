"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Search, Menu, LogOut } from "lucide-react";
import QuickAdd from "./QuickAdd";
import { NotificationBell } from "./NotificationBell";

interface HeaderProps {
  onSearch?: (query: string) => void;
  searchQuery?: string;
  onAddTodo?: (title: string) => Promise<void>;
  onAddNote?: (title: string) => Promise<void>;
  onAddInbox?: (content: string) => Promise<void>;
  onToggleSidebar?: () => void;
}

const pageTitles: Record<string, string> = {
  "/": "Today",
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
  searchQuery = "",
  onAddTodo,
  onAddNote,
  onAddInbox,
  onToggleSidebar,
}: HeaderProps) {
  const pathname = usePathname();
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
      {/* Mobile menu + Page Title */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground min-w-0 truncate">
          {title}
        </h1>
      </div>

      {/* Search Bar - hidden on mobile, shown on sm+ */}
      <form
        onSubmit={handleSearch}
        className={`hidden sm:flex flex-1 max-w-md mx-auto transition-all duration-200 ${
          searchFocused ? "max-w-lg" : ""
        }`}
      >
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
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
        <button
          onClick={async () => {
            const { signOut } = await import("next-auth/react");
            signOut({ callbackUrl: "/login" });
          }}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
        {/* Mobile search toggle */}
        <button
          className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Search"
          onClick={() => {
            const q = prompt("Search:");
            if (q) onSearch?.(q);
          }}
        >
          <Search className="w-5 h-5" />
        </button>

        <QuickAdd
          onAddTodo={onAddTodo}
          onAddNote={onAddNote}
          onAddInbox={onAddInbox}
        />

        <NotificationBell />
      </div>
    </header>
  );
}
