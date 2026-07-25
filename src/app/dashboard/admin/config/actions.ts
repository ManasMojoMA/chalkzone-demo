"use server";

import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { hasSectionEdit } from "@/app/dashboard/admin/permissions/actions";
import { revalidatePath } from "next/cache";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;
function revalidate() {
  revalidatePath("/dashboard/admin/config");
  revalidatePath("/dashboard/programs");
}

// ─── Course Master (Configuration → Course Master) ──────────────────────────
// The global catalogue. A course is authored once here and IMPORTED into any
// number of programmes (Program Management → programme → Courses), each
// import creating its own Subject "copy". Editing/deleting a copy never
// touches the master or any other programme's copy.

export async function listCourseMaster() {
  await requireRole(...ADMIN_ROLES);
  return prisma.courseMaster.findMany({
    include: { _count: { select: { copies: true } } },
    orderBy: { code: "asc" },
  });
}

export async function saveCourseMaster(data: { id?: string; code: string; name: string; credits: number }) {
  await requireRole(...ADMIN_ROLES);
  if (!(await hasSectionEdit("configuration"))) return { success: false as const, error: "Your role has view-only access to Configuration." };
  if (!data.code.trim()) return { success: false as const, error: "Course code is required" };
  if (!data.name.trim()) return { success: false as const, error: "Course name is required" };
  if (data.credits < 0 || data.credits > 40) return { success: false as const, error: "Credits must be 0–40" };
  try {
    const payload = { code: data.code.trim().toUpperCase(), name: data.name.trim(), credits: data.credits };
    if (data.id) await prisma.courseMaster.update({ where: { id: data.id }, data: payload });
    else await prisma.courseMaster.create({ data: payload });
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "A course with this code already exists in the master catalogue" };
  }
}

export async function deleteCourseMaster(id: string) {
  await requireRole(...ADMIN_ROLES);
  const master = await prisma.courseMaster.findUnique({ where: { id }, include: { _count: { select: { copies: true } } } });
  if (!master) return { success: false as const, error: "Course not found" };
  if (master._count.copies > 0) {
    return { success: false as const, error: `This course is imported into ${master._count.copies} programme(s) — remove those imports first.` };
  }
  await prisma.courseMaster.delete({ where: { id } });
  revalidate();
  return { success: true as const };
}

/** Import a master course into a programme, creating a local copy. If
 *  already imported (same code in that programme), refreshes name/credits
 *  from the current master instead of erroring. */
export async function importCourseToProgram(courseMasterId: string, programId: string, semester?: number | null) {
  await requireRole(...ADMIN_ROLES);
  if (!(await hasSectionEdit("configuration"))) return { success: false as const, error: "Your role has view-only access." };
  const master = await prisma.courseMaster.findUnique({ where: { id: courseMasterId } });
  if (!master) return { success: false as const, error: "Course not found in the master catalogue" };

  const existing = await prisma.subject.findUnique({ where: { programId_code: { programId, code: master.code } } });
  if (existing) {
    await prisma.subject.update({
      where: { id: existing.id },
      data: { name: master.name, credits: master.credits, courseMasterId: master.id, semester: semester ?? existing.semester },
    });
    revalidate();
    return { success: true as const, refreshed: true };
  }
  await prisma.subject.create({
    data: { programId, code: master.code, name: master.name, credits: master.credits, courseMasterId: master.id, semester: semester ?? null },
  });
  revalidate();
  return { success: true as const, refreshed: false };
}

// ─── Section Labels (Configuration → Section Labels) ────────────────────────
// Reusable section names, mapped into a concrete section per batch+semester
// in Program Management.

export async function listSectionLabels() {
  await requireRole(...ADMIN_ROLES);
  return prisma.sectionLabel.findMany({
    include: { _count: { select: { sections: true } } },
    orderBy: { name: "asc" },
  });
}

export async function saveSectionLabel(data: { id?: string; name: string }) {
  await requireRole(...ADMIN_ROLES);
  if (!(await hasSectionEdit("configuration"))) return { success: false as const, error: "Your role has view-only access to Configuration." };
  if (!data.name.trim()) return { success: false as const, error: "Section label is required" };
  try {
    if (data.id) await prisma.sectionLabel.update({ where: { id: data.id }, data: { name: data.name.trim() } });
    else await prisma.sectionLabel.create({ data: { name: data.name.trim() } });
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "That section label already exists" };
  }
}

export async function deleteSectionLabel(id: string) {
  await requireRole(...ADMIN_ROLES);
  const label = await prisma.sectionLabel.findUnique({ where: { id }, include: { _count: { select: { sections: true } } } });
  if (!label) return { success: false as const, error: "Label not found" };
  if (label._count.sections > 0) {
    return { success: false as const, error: `${label._count.sections} section(s) use this label — remove them first.` };
  }
  await prisma.sectionLabel.delete({ where: { id } });
  revalidate();
  return { success: true as const };
}
