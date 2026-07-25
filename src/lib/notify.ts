import prisma from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

/**
 * Server-side fan-out helper. Fire-and-forget from server actions — a failed
 * notification must never break the action that triggered it.
 */
export async function notify(
  userIds: string[],
  data: { type: NotificationType; title: string; body?: string; link?: string },
  excludeUserId?: string
) {
  const targets = [...new Set(userIds)].filter((id) => id && id !== excludeUserId);
  if (targets.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: targets.map((userId) => ({
        userId,
        type: data.type,
        title: data.title,
        body: data.body,
        link: data.link,
      })),
    });
  } catch (e) {
    console.error("notify() failed:", e);
  }
}

/** All active users holding one of the given roles. */
export async function userIdsByRole(...roles: ("FACULTY" | "HR" | "MANAGER" | "ADMIN" | "SUPER_ADMIN")[]) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
