"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadNotifications() {
    setLoadError(false);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Notifications request failed");
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.notifications || []);
      setNotifications(list);
      setUnreadCount(data.unreadCount ?? list.filter((n: Notification) => !n.read).length);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markAllRead() {
    setActionError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (!response.ok) throw new Error("Mark all read failed");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      setActionError("Notifications could not be updated. Please try again.");
    }
  }

  async function markRead(id: string) {
    setActionError("");
    try {
      const response = await fetch(`/api/notifications/${id}`, { method: "PUT" });
      if (!response.ok) throw new Error("Mark read failed");
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      setActionError("That notification could not be updated. Please try again.");
    }
  }

  const typeColor: Record<string, string> = {
    achievement: "text-yellow-500",
    streak: "text-orange-500",
    reminder: "text-blue-500",
    info: "text-muted-foreground",
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loadError ? (
              <div role="alert" className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Unable to load notifications.</p>
                <button type="button" onClick={loadNotifications} className="mt-2 min-h-11 px-3 text-sm font-medium text-primary hover:underline">
                  Try again
                </button>
              </div>
            ) : loading ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Loading notifications…</p>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 border-b border-border last:border-0 hover:bg-accent/50 cursor-pointer transition-colors ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => {
                    if (!n.read) markRead(n.id);
                    if (n.actionUrl) window.location.href = n.actionUrl;
                    setOpen(false);
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 text-xs ${typeColor[n.type] || typeColor.info}`}
                    >
                      ●
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          !n.read ? "font-semibold text-foreground" : "text-foreground"
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {n.message}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(n.id);
                        }}
                        className="p-1 hover:bg-accent rounded"
                      >
                        <Check className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          {actionError && <p role="alert" className="border-t border-border p-3 text-xs text-destructive">{actionError}</p>}
        </div>
      )}
    </div>
  );
}
