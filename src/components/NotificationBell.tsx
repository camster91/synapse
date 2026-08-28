"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

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
  const { isSupported, permission, subscribe, isSubscribed } =
    usePushNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadNotifications() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.notifications || []);
        setNotifications(list);
        setUnreadCount(data.unreadCount ?? list.filter((n: Notification) => !n.read).length);
      }
    } catch {
      // Will retry on next interval
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
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PUT" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
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
        {isSupported && isSubscribed ? (
          <Bell className="w-5 h-5 text-foreground" />
        ) : (
          <BellOff className="w-5 h-5 text-muted-foreground" />
        )}
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
              {isSupported && !isSubscribed && permission !== "denied" && (
                <button
                  onClick={subscribe}
                  className="text-xs text-primary hover:underline"
                >
                  Enable push
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
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
        </div>
      )}
    </div>
  );
}
