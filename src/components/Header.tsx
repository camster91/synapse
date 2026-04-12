"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Search, Bell, Plus, CheckSquare, FileText, Inbox, Menu } from "lucide-react";
import QuickAdd from "./QuickAdd";

interface HeaderProps {
  onSearch?: (query: string) => void;
  onAddTodo?: (title: string) => void;
  onAddNote?: (title: string) => void;
  onAddInbox?: (content: string) => void;
  onToggleSidebar?: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
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

function timeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return then.toLocaleDateString();
}

export default function Header({
  onSearch,
  onAddTodo,
  onAddNote,
  onAddInbox,
  onToggleSidebar,
}: HeaderProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const title =
    pageTitles[pathname] ||
    (pathname.startsWith("/notes/") ? "Note" : pathname.startsWith("/todos/") ? "Todo" : "Synapse");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark notifications as read when dropdown opens
  const handleBellClick = async () => {
    const newOpen = !dropdownOpen;
    setDropdownOpen(newOpen);

    if (newOpen && unreadCount > 0) {
      const unreadIds = notifications
        .filter((n) => !n.read)
        .slice(0, 5)
        .map((n) => n.id);

      // Optimistically mark as read in UI
      setNotifications((prev) =>
        prev.map((n) =>
          unreadIds.includes(n.id) ? { ...n, read: true } : n
        )
      );

      // Mark as read on server (fire and forget)
      for (const id of unreadIds) {
        fetch(`/api/notifications/${id}`, { method: "PUT" }).catch(() => {});
      }
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const recentNotifications = notifications.slice(0, 5);

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

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleBellClick}
            className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  Notifications
                </h3>
              </div>
              {recentNotifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No notifications yet
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  {recentNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors ${
                        !notification.read ? "bg-muted/20" : ""
                      }`}
                    >
                      {notification.actionUrl ? (
                        <a
                          href={notification.actionUrl}
                          className="block"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {notification.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                              {timeAgo(notification.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {notification.message}
                          </p>
                        </a>
                      ) : (
                        <div>
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {notification.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                              {timeAgo(notification.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {notification.message}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}