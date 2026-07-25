"use server";

import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function getMyNotifications() {
  const user = await requireUser();
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);
  return { items, unread };
}

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { isRead: true },
  });
  return { success: true as const };
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  return { success: true as const };
}
