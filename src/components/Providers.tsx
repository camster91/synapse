"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface AppContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  notifications: Notification[];
  setNotifications: (n: Notification[]) => void;
}

const AppContext = createContext<AppContextType>({
  sidebarOpen: false,
  setSidebarOpen: () => {},
  notifications: [],
  setNotifications: () => {},
});

export const useApp = () => useContext(AppContext);

export function Providers({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Register service worker for PWA
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      );
      if ("caches" in window) {
        void caches.keys().then((keys) =>
          Promise.all(keys.filter((key) => key.startsWith("synapse-")).map((key) => caches.delete(key)))
        );
      }
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => {
        console.warn("[pwa] Service worker registration failed:", err);
      });
  }, []);

  return (
    <AppContext.Provider value={{ sidebarOpen, setSidebarOpen, notifications, setNotifications }}>
      {children}
    </AppContext.Provider>
  );
}
