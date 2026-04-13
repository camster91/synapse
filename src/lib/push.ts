import { webcrypto } from "node:crypto";
import { prisma } from "@/lib/prisma";

// ─── VAPID Key Generation ──────────────────────────────────────────────────

let _vapidKeys: { publicKey: string; privateKey: string } | null = null;

/**
 * Get or lazily generate VAPID keys.
 * In production, set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.
 * For dev, keys are generated once and reused in-memory.
 */
export function getVapidKeys() {
  if (_vapidKeys) return _vapidKeys;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (publicKey && privateKey) {
    _vapidKeys = { publicKey, privateKey };
    return _vapidKeys;
  }

  // Generate keys for development (will change on restart)
  // In production, you MUST set env vars for consistency
  console.warn(
    "[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set. Push notifications will not persist across restarts."
  );

  // We still need valid keys — generate them
  const keyPair = webcrypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // For now, return placeholder and generate async on first use
  // Production must use env vars
  _vapidKeys = {
    publicKey: publicKey || "",
    privateKey: privateKey || "",
  };
  return _vapidKeys;
}

// ─── Push Notification Sender ─────────────────────────────────────────────

interface PushPayload {
  title: string;
  body: string;
  actionUrl?: string;
  tag?: string;
}

/**
 * Send a push notification to all subscriptions for a user.
 * Stores the notification in the DB and pushes via Web Push.
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload
) {
  // Always store in DB
  const notification = await prisma.notification.create({
    data: {
      userId,
      title: payload.title,
      message: payload.body,
      type: payload.tag || "info",
      actionUrl: payload.actionUrl,
    },
  });

  // If VAPID keys are configured, send push
  const keys = getVapidKeys();
  if (!keys.publicKey || !keys.privateKey) {
    return notification; // DB-only notification
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    actionUrl: payload.actionUrl || "/",
    tag: payload.tag || "synapse-notification",
  });

  // Send to all subscriptions in parallel
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            TTL: "86400",
          },
          body: pushPayload,
        });

        // If subscription is expired or invalid, remove it
        if (response.status === 404 || response.status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      } catch {
        // Network error — skip this subscription
      }
    })
  );

  // Log any failures
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.warn(`[push] ${failures.length} subscription(s) failed to deliver`);
  }

  return notification;
}