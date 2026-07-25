"use server";

import prisma from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { APP_SECTIONS, MANAGED_ROLES, type PermissionLevel, type SectionKey } from "@/lib/permissions";

const LEVELS: PermissionLevel[] = ["NONE", "VIEW", "EDIT"];

/** The signed-in user's effective access map (section → level).
 *  SUPER_ADMIN gets EDIT everywhere; others get their overrides with EDIT
 *  as the default (today's behaviour when nothing is configured). */
export async function getMyPermissions(): Promise<Record<string, PermissionLevel>> {
  const user = await requireUser();
  const map: Record<string, PermissionLevel> = {};
  for (const s of APP_SECTIONS) map[s.key] = "EDIT";
  if (user.role === "SUPER_ADMIN") return map;

  const rows = await prisma.rolePermission.findMany({ where: { role: user.role } });
  for (const r of rows) {
    if (r.section in map && LEVELS.includes(r.level as PermissionLevel)) {
      map[r.section] = r.level as PermissionLevel;
    }
  }
  return map;
}

/** Full matrix for the Access Control tab (master admin only). */
export async function getPermissionMatrix() {
  await requireRole("SUPER_ADMIN");
  const rows = await prisma.rolePermission.findMany();
  const matrix: Record<string, Record<string, PermissionLevel>> = {};
  for (const role of MANAGED_ROLES) {
    matrix[role] = {};
    for (const s of APP_SECTIONS) matrix[role][s.key] = "EDIT";
  }
  for (const r of rows) {
    if (matrix[r.role] && r.section in matrix[r.role] && LEVELS.includes(r.level as PermissionLevel)) {
      matrix[r.role][r.section] = r.level as PermissionLevel;
    }
  }
  return matrix;
}

export async function setPermission(role: string, section: SectionKey, level: PermissionLevel) {
  await requireRole("SUPER_ADMIN");
  if (!MANAGED_ROLES.includes(role as (typeof MANAGED_ROLES)[number])) {
    return { success: false as const, error: "That role can't be restricted" };
  }
  if (!APP_SECTIONS.some((s) => s.key === section) || !LEVELS.includes(level)) {
    return { success: false as const, error: "Invalid section or level" };
  }
  if (level === "EDIT") {
    // EDIT is the default — store nothing, keep the table small
    await prisma.rolePermission.deleteMany({ where: { role, section } });
  } else {
    await prisma.rolePermission.upsert({
      where: { role_section: { role, section } },
      update: { level },
      create: { role, section, level },
    });
  }
  revalidatePath("/dashboard");
  return { success: true as const };
}

/** Non-throwing check used by write actions that return {success,error}. */
export async function hasSectionEdit(section: SectionKey): Promise<boolean> {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") return true;
  const row = await prisma.rolePermission.findUnique({
    where: { role_section: { role: user.role, section } },
  });
  return !row || row.level === "EDIT";
}

/** Server-side guard for mutating actions: throws unless the caller's role
 *  has EDIT on the section. Call at the top of write actions. */
export async function requireSectionEdit(section: SectionKey) {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN") return user;
  const row = await prisma.rolePermission.findUnique({
    where: { role_section: { role: user.role, section } },
  });
  if (row && row.level !== "EDIT") {
    throw new Error("Your role has view-only access to this section. Ask an administrator for edit access.");
  }
  return user;
}
