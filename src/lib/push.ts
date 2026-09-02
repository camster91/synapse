import { prisma } from "@/lib/prisma";

// ─── Push Notification Sender ─────────────────────────────────────────────

interface PushPayload {
  title: string;
  body: string;
  actionUrl?: string;
  tag?: string;
}

/**
 * Store an in-app notification for a user.
 *
 * Browser Web Push delivery is intentionally disabled until Synapse uses a
 * standards-compliant sender with constrained destinations. Never issue a raw
 * fetch to a tenant-supplied subscription endpoint.
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload
) {
  return prisma.notification.create({
    data: {
      userId,
      title: payload.title,
      message: payload.body,
      type: payload.tag || "info",
      actionUrl: payload.actionUrl,
    },
  });
}
