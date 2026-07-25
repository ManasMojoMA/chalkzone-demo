"use server";

import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/** Marks the first-login walkthrough as completed — it never auto-shows again. */
export async function markTourSeen() {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { hasSeenTour: true } });
  return { success: true as const };
}

/** Full demographic view of the signed-in user (role-specific profile included). */
export async function getMyProfile() {
  const user = await requireUser();

  const [student, faculty, hr] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: user.id } }),
    prisma.facultyProfile.findUnique({ where: { userId: user.id } }),
    prisma.hRProfile.findUnique({ where: { userId: user.id }, include: { company: true } }),
  ]);

  return {
    user: {
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
      memberSince: user.createdAt,
    },
    student,
    faculty,
    hr,
  };
}
