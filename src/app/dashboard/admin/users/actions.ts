"use server";

import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@prisma/client";

const ALL_ROLES = ["STUDENT", "FACULTY", "HR", "MANAGER", "ADMIN", "SUPER_ADMIN", "PARENT", "EXECUTIVE"] as const;

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  mobile: z.string().trim().min(7, "A valid mobile number is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ALL_ROLES),
  // role-specific identifiers
  rollNo: z.string().trim().optional(),
  employeeCode: z.string().trim().optional(),
  programId: z.string().trim().optional(),
  batchId: z.string().trim().optional(),
  department: z.string().trim().optional(),
  designation: z.string().trim().optional(),
});

export async function getUsers() {
  await requireRole("ADMIN", "SUPER_ADMIN", "MANAGER", "HR");
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      studentProfile: true,
      facultyProfile: true,
      hrProfile: true,
    }
  });
  return users;
}

export async function updateUserRole(userId: string, role: Role) {
  await requireRole("ADMIN", "SUPER_ADMIN");
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });
  return { success: true, user };
}

export async function toggleUserStatus(userId: string, isActive: boolean) {
  const actor = await requireRole("ADMIN", "SUPER_ADMIN");
  if (actor.id === userId) return { success: false as const, error: "You can't deactivate your own account" };
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });
  return { success: true as const, user };
}

/** Provision a new account: Supabase Auth user + app user + role profile.
 *  Students must be placed into a real programme + batch at onboarding time —
 *  both dropdowns are sourced from Configuration / Program Management. */
export async function createUser(data: unknown) {
  await requireRole("ADMIN", "SUPER_ADMIN");
  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues?.[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  if (input.role === "STUDENT") {
    if (!input.rollNo) return { success: false as const, error: "Roll number is required for students" };
    if (!input.programId) return { success: false as const, error: "Programme is required for students" };
    if (!input.batchId) return { success: false as const, error: "Batch is required for students" };
  }
  if (input.role === "FACULTY" && !input.employeeCode) {
    return { success: false as const, error: "Employee code is required for faculty" };
  }
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) return { success: false as const, error: "A user with this email already exists" };

  let programName: string | null = null;
  if (input.role === "STUDENT" && input.batchId) {
    const batch = await prisma.batch.findUnique({ where: { id: input.batchId }, include: { program: true } });
    if (!batch) return { success: false as const, error: "That batch no longer exists" };
    if (batch.programId !== input.programId) return { success: false as const, error: "That batch doesn't belong to the chosen programme" };
    programName = batch.program.name;
  }

  // 1. Auth account (email pre-confirmed — accounts are provisioned by the university)
  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (authError || !created.user) {
    return { success: false as const, error: authError?.message ?? "Failed to create the login account" };
  }

  // 2. App user + role profile
  try {
    await prisma.user.create({
      data: {
        supabaseUid: created.user.id,
        email: input.email,
        name: input.name,
        mobile: input.mobile,
        role: input.role,
        ...(input.role === "STUDENT"
          ? { studentProfile: { create: { rollNo: input.rollNo!, batchId: input.batchId!, program: programName } } }
          : {}),
        ...(input.role === "FACULTY"
          ? { facultyProfile: { create: { employeeCode: input.employeeCode!, department: input.department || null, designation: input.designation || null } } }
          : {}),
      },
    });
  } catch (e) {
    // roll the auth account back so a retry isn't blocked by a half-created user
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    const msg = e instanceof Error && e.message.includes("Unique constraint")
      ? "That roll number / employee code is already taken"
      : "Failed to create the user profile";
    return { success: false as const, error: msg };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true as const };
}

// ─── CSV bulk-onboard students ───────────────────────────────────────────────

type CsvRow = { rollNo: string; name: string; email: string; mobile: string; programme: string; batch: string; password?: string };

/** Bulk-create student accounts from parsed CSV rows. Programme/batch are
 *  matched by name (case-insensitive) against real catalogue entries — rows
 *  that don't match a real programme+batch are reported, not guessed at. */
export async function importStudentsCsv(rows: CsvRow[]) {
  await requireRole("ADMIN", "SUPER_ADMIN");
  if (rows.length === 0) return { ok: 0, failed: [], error: "The file had no data rows" };
  if (rows.length > 1000) return { ok: 0, failed: [], error: "Please import at most 1000 rows at a time" };

  const batches = await prisma.batch.findMany({ include: { program: true } });

  // Prefetch existing emails & roll numbers in two queries instead of two per
  // row — at 1000 rows that's 2 queries instead of 2000.
  const emails = rows.map((r) => (r.email || "").trim().toLowerCase()).filter(Boolean);
  const rolls = rows.map((r) => (r.rollNo || "").trim()).filter(Boolean);
  const [existingUsers, existingRolls] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } }),
    prisma.studentProfile.findMany({ where: { rollNo: { in: rolls } }, select: { rollNo: true } }),
  ]);
  const takenEmails = new Set(existingUsers.map((u) => u.email));
  const takenRolls = new Set(existingRolls.map((s) => s.rollNo));

  const admin = createAdminClient();
  const failed: { row: number; rollNo: string; reason: string }[] = [];
  let ok = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    const rollNo = (r.rollNo || "").trim();
    const email = (r.email || "").trim().toLowerCase();
    const name = (r.name || "").trim();
    const mobile = (r.mobile || "").trim();
    const programmeName = (r.programme || "").trim();
    const batchLabel = (r.batch || "").trim();

    if (!rollNo || !email || !name || !mobile) {
      failed.push({ row: line, rollNo, reason: "Missing roll number, name, email or mobile" });
      continue;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      failed.push({ row: line, rollNo, reason: "Invalid email" });
      continue;
    }
    const batch = batches.find(
      (b) => b.program.name.toLowerCase() === programmeName.toLowerCase() && b.label === batchLabel
    );
    if (!batch) {
      failed.push({ row: line, rollNo, reason: `No batch "${batchLabel}" found under programme "${programmeName}" — check Configuration → Programmes/Batches` });
      continue;
    }

    if (takenEmails.has(email)) { failed.push({ row: line, rollNo, reason: "Email already registered" }); continue; }
    if (takenRolls.has(rollNo)) { failed.push({ row: line, rollNo, reason: "Roll number already used" }); continue; }
    takenEmails.add(email); // also guards duplicates within the same file
    takenRolls.add(rollNo);

    const password = (r.password || "").trim() || "Password123!";
    const { data: created, error: authErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (authErr || !created.user) {
      failed.push({ row: line, rollNo, reason: authErr?.message ?? "Could not create login" });
      continue;
    }
    try {
      await prisma.user.create({
        data: {
          supabaseUid: created.user.id,
          email, name, mobile, role: "STUDENT",
          studentProfile: { create: { rollNo, batchId: batch.id, program: batch.program.name } },
        },
      });
      ok++;
    } catch (e) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
      const msg = e instanceof Error && e.message.includes("Unique constraint") ? "Duplicate roll/email" : "Could not save profile";
      failed.push({ row: line, rollNo, reason: msg });
    }
  }

  revalidatePath("/dashboard/admin/users");
  revalidatePath("/dashboard/programs");
  return { ok, failed, error: null as string | null };
}

/** Rename a user (email stays fixed — it is the login identity). */
export async function updateUserName(userId: string, name: string) {
  await requireRole("ADMIN", "SUPER_ADMIN");
  if (!name.trim()) return { success: false as const, error: "Name is required" };
  await prisma.user.update({ where: { id: userId }, data: { name: name.trim() } });
  revalidatePath("/dashboard/admin/users");
  return { success: true as const };
}

/** Sections available to assign a student to (with readable labels). */
export async function listAssignableSections() {
  await requireRole("ADMIN", "SUPER_ADMIN", "MANAGER", "HR");
  const sections = await prisma.programSection.findMany({
    include: { program: { select: { name: true } }, batch: { select: { label: true } } },
    orderBy: [{ program: { name: "asc" } }, { semester: "asc" }, { name: "asc" }],
  });
  return sections.map((s) => ({
    id: s.id,
    label: `${s.program.name} · ${s.batch.label} · Sem ${s.semester} · Sec ${s.name}`,
    programName: s.program.name,
    semester: s.semester,
    sectionName: s.name,
  }));
}

const editUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  mobile: z.string().trim().optional(),
  // student identity only — batch & section placement is done in Program Management
  rollNo: z.string().trim().optional(),
  // faculty
  employeeCode: z.string().trim().optional(),
  department: z.string().trim().optional(),
  designation: z.string().trim().optional(),
});

/** Edit a user's IDENTITY details (name, mobile, roll no / employee code,
 *  department, designation). A student's batch & section placement is managed
 *  exclusively in Program Management and is deliberately left untouched here. */
export async function updateUserDetails(userId: string, data: unknown) {
  await requireRole("ADMIN", "SUPER_ADMIN");
  const parsed = editUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues?.[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true, facultyProfile: true },
  });
  if (!user) return { success: false as const, error: "User not found" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { name: input.name.trim(), mobile: input.mobile?.trim() || null } });

      if (user.role === "STUDENT") {
        // Only the roll number is edited here; program/batch/section are owned
        // by Program Management and must not be overwritten.
        await tx.studentProfile.update({
          where: { userId },
          data: { rollNo: input.rollNo?.trim() || user.studentProfile?.rollNo || null },
        });
      }

      if (user.role === "FACULTY") {
        const facultyData = {
          employeeCode: input.employeeCode?.trim() || user.facultyProfile?.employeeCode || null,
          department: input.department?.trim() || null,
          designation: input.designation?.trim() || null,
        };
        await tx.facultyProfile.upsert({
          where: { userId },
          update: facultyData,
          create: { userId, ...facultyData },
        });
      }
    });
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique constraint")
      ? "That roll number / employee code is already taken"
      : "Failed to save changes";
    return { success: false as const, error: msg };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true as const };
}

/** Permanently remove an account (master admin only). Users with linked
 *  records (tickets, marks…) can't be hard-deleted — deactivate them instead. */
export async function deleteUser(userId: string) {
  const actor = await requireRole("SUPER_ADMIN");
  if (actor.id === userId) return { success: false as const, error: "You can't delete your own account" };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { success: false as const, error: "User not found" };
  if (target.role === "SUPER_ADMIN") {
    return { success: false as const, error: "Master-admin accounts can't be deleted from the UI" };
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    return {
      success: false as const,
      error: "This user has linked records (tickets, attendance, marks…). Deactivate the account instead.",
    };
  }
  if (target.supabaseUid) {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(target.supabaseUid).catch((e) => {
      console.error("Auth cleanup failed for", target.email, e);
    });
  }
  revalidatePath("/dashboard/admin/users");
  return { success: true as const };
}
