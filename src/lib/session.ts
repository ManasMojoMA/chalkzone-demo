// Server-side session helpers. Server actions must derive the current user
// from the session cookie instead of trusting client-supplied ids.
//
// Dev mode: the cookie stores the user id and is validated against the DB.
// When Supabase Auth lands, only this file needs to change — swap the cookie
// lookup for Supabase JWT/session validation and keep the same helpers.

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import type { Role, User } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";

export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user: authUser }, error } = await supabase.auth.getUser();
  
  if (error || !authUser) return null;

  const user = await prisma.user.findFirst({ where: { supabaseUid: authUser.id } });
  if (!user || !user.isActive) return null;
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Not authenticated. Please log in again.");
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new Error("You do not have permission to perform this action.");
  }
  return user;
}

/** Staff roles that may view/manage records they don't own. */
export const STAFF_ROLES: Role[] = ["FACULTY", "HR", "MANAGER", "ADMIN", "SUPER_ADMIN"];

export function isStaff(user: User): boolean {
  return STAFF_ROLES.includes(user.role);
}

/** The student profile of the current session user, or null. */
export async function getSessionStudentProfile() {
  const user = await requireUser();
  return prisma.studentProfile.findUnique({ where: { userId: user.id } });
}

/** The faculty profile of the current session user, or null. */
export async function getSessionFacultyProfile() {
  const user = await requireUser();
  return prisma.facultyProfile.findUnique({ where: { userId: user.id } });
}
