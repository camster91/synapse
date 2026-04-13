"use client";

import { useEffect, useState, useCallback } from "react";

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | "default";
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  isSubscribed: boolean;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!isSupported) return;

    setPermission(Notification.permission);

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);
        // Check if already subscribed
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        setIsSubscribed(!!sub);
      })
      .catch((err) => {
        console.warn("[push] Service worker registration failed:", err);
      });
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!registration) return;

    // Request permission
    const perm = await Notification.requestPermission();
    setPermission(perm);

    if (perm !== "granted") return;

    // Subscribe to push — using applicationServerKey if VAPID_PUBLIC_KEY is available
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // applicationServerKey would go here if VAPID is configured
    });

    // Send subscription to server
    const subJson = subscription.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: subJson.keys,
      }),
    });

    setIsSubscribed(true);
  }, [registration]);

  const unsubscribe = useCallback(async () => {
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();

      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    }

    setIsSubscribed(false);
  }, [registration]);

  return { isSupported, permission, subscribe, unsubscribe, isSubscribed };
}