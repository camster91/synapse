"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Search, Menu, LogOut, X } from "lucide-react";
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const title =
    pageTitles[pathname] ||
    (pathname.startsWith("/notes/") ? "Note" : pathname.startsWith("/todos/") ? "Todo" : "Synapse");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <header className="relative h-14 border-b border-border bg-card flex items-center justify-between px-4 gap-4 flex-shrink-0">
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
        className={`${mobileSearchOpen ? "absolute inset-x-2 top-2 z-20 flex bg-card" : "hidden"} sm:static sm:flex flex-1 max-w-md mx-auto transition-all duration-200 ${
          searchFocused ? "max-w-lg" : ""
        }`}
      >
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <label htmlFor="global-search-trigger" className="sr-only">Search everything</label>
          <input
            id="global-search-trigger"
            aria-haspopup="dialog"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearch?.(e.target.value);
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoFocus={mobileSearchOpen}
            placeholder="Search everything..."
            className="w-full pl-9 pr-10 sm:pr-4 py-1.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
          <button
            type="button"
            aria-label="Close search field"
            onClick={() => {
              setMobileSearchOpen(false);
              onSearch?.("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground sm:hidden"
          >
            <X className="h-4 w-4" />
          </button>
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
          type="button"
          className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Search"
          onClick={() => setMobileSearchOpen(true)}
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
