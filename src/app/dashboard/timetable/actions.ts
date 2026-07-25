"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/session";
import { hasSectionEdit } from "@/app/dashboard/admin/permissions/actions";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;
export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
const DAYS: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MAX_PERIOD = 8;

function revalidate() {
  revalidatePath("/dashboard/timetable");
}

/** The 5 consecutive attendance days for a section, given its window start. */
export async function getWorkingDays(weekStart: string): Promise<Weekday[]> {
  const start = Math.max(0, DAYS.indexOf(weekStart as Weekday));
  return Array.from({ length: 5 }, (_, i) => DAYS[(start + i) % 7]);
}

function workingDaysOf(weekStart: string): Weekday[] {
  const start = Math.max(0, DAYS.indexOf(weekStart as Weekday));
  return Array.from({ length: 5 }, (_, i) => DAYS[(start + i) % 7]);
}

// ─── Programs ───────────────────────────────────────────────────────────────

export async function listPrograms() {
  await requireUser();
  return prisma.program.findMany({
    include: {
      sections: {
        include: { batch: { select: { id: true, label: true } }, _count: { select: { assignments: true, slots: true } } },
        orderBy: [{ semester: "asc" }, { name: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function saveProgram(data: { id?: string; name: string; totalStudents: number }) {
  await requireRole(...ADMIN_ROLES);
  if (!(await hasSectionEdit("configuration"))) return { success: false as const, error: "Your role has view-only access to Configuration. Ask an administrator for edit access." };
  if (!data.name.trim()) return { success: false as const, error: "Name is required" };
  try {
    if (data.id) {
      await prisma.program.update({ where: { id: data.id }, data: { name: data.name.trim(), totalStudents: data.totalStudents } });
    } else {
      await prisma.program.create({ data: { name: data.name.trim(), totalStudents: data.totalStudents } });
    }
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "A programme with this name already exists" };
  }
}

export async function deleteProgram(id: string) {
  await requireRole(...ADMIN_ROLES);
  // Courses hang off the programme (RESTRICT) — surface a clear next step
  // instead of a silent foreign-key failure. Marks/attendance hang off the
  // courses in turn, so we never cascade-delete them implicitly.
  const courseCount = await prisma.subject.count({ where: { programId: id } });
  if (courseCount > 0) {
    return {
      success: false as const,
      error: `This programme still has ${courseCount} course${courseCount > 1 ? "s" : ""} mapped to it — move or delete them in Configuration → Courses first.`,
    };
  }
  try {
    await prisma.program.delete({ where: { id } });
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Couldn't delete this programme — it still has linked records." };
  }
}

// ─── Sections ───────────────────────────────────────────────────────────────

export async function saveSection(data: {
  id?: string;
  programId: string;
  batchId: string;
  semester: number;
  name: string;
  type: "CORE" | "ELECTIVE" | "MIXED";
  studentCount: number;
  weekStart: string;
}) {
  await requireRole(...ADMIN_ROLES);
  if (!(await hasSectionEdit("timetable"))) return { success: false as const, error: "Your role has view-only access to the timetable. Ask an administrator for edit access." };
  if (!data.name.trim()) return { success: false as const, error: "Section name is required" };
  if (!data.batchId) return { success: false as const, error: "Pick a batch (create batches in Configuration → Batches)" };
  if (!DAYS.includes(data.weekStart as Weekday)) return { success: false as const, error: "Invalid week start" };
  if (data.semester < 1 || data.semester > 12) return { success: false as const, error: "Semester must be 1–12" };
  try {
    // batch determines the programme — keep programId in sync for fast queries
    const batch = await prisma.batch.findUnique({ where: { id: data.batchId } });
    if (!batch) return { success: false as const, error: "That batch no longer exists" };
    const payload = {
      programId: batch.programId,
      batchId: data.batchId,
      semester: data.semester,
      name: data.name.trim(),
      type: data.type,
      studentCount: data.studentCount,
      weekStart: data.weekStart,
    };
    if (data.id) await prisma.programSection.update({ where: { id: data.id }, data: payload });
    else await prisma.programSection.create({ data: payload });
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "This section already exists for that batch & semester" };
  }
}

export async function deleteSection(id: string) {
  await requireRole(...ADMIN_ROLES);
  await prisma.programSection.delete({ where: { id } });
  revalidate();
  return { success: true as const };
}

// ─── Courses (subjects) — created in Configuration, mapped to a programme ───

export async function listSubjects() {
  await requireUser();
  return prisma.subject.findMany({
    include: {
      program: { select: { id: true, name: true } },
      _count: { select: { sectionAssignments: true, attendances: true, marks: true } },
    },
    orderBy: { code: "asc" },
  });
}

export async function saveSubject(data: {
  id?: string;
  code: string;
  name: string;
  credits: number;
  programId: string;
  semester?: number | null;
}) {
  await requireRole(...ADMIN_ROLES);
  if (!(await hasSectionEdit("configuration"))) return { success: false as const, error: "Your role has view-only access to Configuration. Ask an administrator for edit access." };
  if (!data.code.trim()) return { success: false as const, error: "Course code is required" };
  if (!data.name.trim()) return { success: false as const, error: "Course name is required" };
  if (!data.programId) return { success: false as const, error: "Pick the programme this course belongs to" };
  if (data.credits < 0 || data.credits > 40) return { success: false as const, error: "Credits must be 0–40" };
  if (data.semester != null && (data.semester < 1 || data.semester > 12)) {
    return { success: false as const, error: "Semester must be 1–12" };
  }
  try {
    const payload = {
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      credits: data.credits,
      programId: data.programId,
      semester: data.semester ?? null,
    };
    if (data.id) await prisma.subject.update({ where: { id: data.id }, data: payload });
    else await prisma.subject.create({ data: payload });
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "A course with this code already exists" };
  }
}

export async function deleteSubject(id: string) {
  await requireRole(...ADMIN_ROLES);
  // Attendance & marks are student records — never silently destroy them.
  const [attendance, marks] = await Promise.all([
    prisma.attendance.count({ where: { subjectId: id } }),
    prisma.marks.count({ where: { subjectId: id } }),
  ]);
  if (attendance > 0 || marks > 0) {
    return {
      success: false as const,
      error: `This course has ${attendance} attendance and ${marks} marks records — it can't be deleted while student data depends on it.`,
    };
  }
  try {
    await prisma.subject.delete({ where: { id } });
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Couldn't delete — remove its section assignments first." };
  }
}

// ─── Course/faculty assignments per section ─────────────────────────────────

export async function listAssignmentOptions() {
  await requireUser();
  const [subjects, faculty] = await Promise.all([
    prisma.subject.findMany({ select: { id: true, code: true, name: true, programId: true, semester: true }, orderBy: { code: "asc" } }),
    prisma.facultyProfile.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { employeeCode: "asc" },
    }),
  ]);
  return { subjects, faculty };
}

export async function listSectionAssignments(sectionId: string) {
  await requireUser();
  return prisma.sectionCourseAssignment.findMany({
    where: { sectionId },
    include: {
      subject: true,
      faculty: { include: { user: { select: { name: true } } } },
      _count: { select: { slots: true } },
    },
    orderBy: { subject: { code: "asc" } },
  });
}

const DEFAULT_WEEKLY_CAP = 16;

/** The weekly-hour cap for a faculty member, from their designation rule
 *  (or the default when they have no matching rule). */
async function facultyWeeklyCap(facultyProfileId: string): Promise<{ cap: number; designation: string | null }> {
  const faculty = await prisma.facultyProfile.findUnique({
    where: { id: facultyProfileId },
    select: { designation: true },
  });
  if (!faculty?.designation) return { cap: DEFAULT_WEEKLY_CAP, designation: faculty?.designation ?? null };
  const rule = await prisma.facultyDesignationRule.findUnique({ where: { designation: faculty.designation } });
  return { cap: rule?.maxWeeklyHours ?? DEFAULT_WEEKLY_CAP, designation: faculty.designation };
}

export async function saveAssignment(data: {
  sectionId: string;
  subjectId: string;
  facultyProfileId: string;
  weeklyHours: number;
}) {
  await requireRole(...ADMIN_ROLES);
  if (!(await hasSectionEdit("timetable"))) return { success: false as const, error: "Your role has view-only access to the timetable. Ask an administrator for edit access." };
  if (data.weeklyHours < 1 || data.weeklyHours > 40) {
    return { success: false as const, error: "Weekly hours must be 1–40" };
  }

  // Enforce the designation's weekly cap across ALL of this faculty's
  // assignments, not just this one — assigning 20h to an 18h-capped
  // Assistant Professor must be blocked here, not only at slot placement.
  const { cap, designation } = await facultyWeeklyCap(data.facultyProfileId);
  const existing = await prisma.sectionCourseAssignment.aggregate({
    _sum: { weeklyHours: true },
    where: {
      facultyProfileId: data.facultyProfileId,
      // exclude the row we're updating (same section+subject) from the running total
      NOT: { sectionId: data.sectionId, subjectId: data.subjectId },
    },
  });
  const alreadyAssigned = existing._sum.weeklyHours ?? 0;
  const projected = alreadyAssigned + data.weeklyHours;
  if (projected > cap) {
    const remaining = Math.max(0, cap - alreadyAssigned);
    return {
      success: false as const,
      error: `This faculty is already assigned ${alreadyAssigned}h/week and their ${designation ?? "default"} cap is ${cap}h. You can assign at most ${remaining}h more here.`,
    };
  }

  try {
    await prisma.sectionCourseAssignment.upsert({
      where: { sectionId_subjectId: { sectionId: data.sectionId, subjectId: data.subjectId } },
      update: { facultyProfileId: data.facultyProfileId, weeklyHours: data.weeklyHours },
      create: data,
    });
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Failed to save assignment" };
  }
}

export async function deleteAssignment(id: string) {
  await requireRole(...ADMIN_ROLES);
  await prisma.sectionCourseAssignment.delete({ where: { id } });
  revalidate();
  return { success: true as const };
}

// ─── Faculty designation rules ──────────────────────────────────────────────

export async function listDesignationRules() {
  await requireUser();
  const [rules, designations] = await Promise.all([
    prisma.facultyDesignationRule.findMany({ orderBy: { designation: "asc" } }),
    prisma.facultyProfile.findMany({
      where: { designation: { not: null } },
      select: { designation: true },
      distinct: ["designation"],
    }),
  ]);
  return { rules, knownDesignations: designations.map((d) => d.designation!) };
}

export async function saveDesignationRule(designation: string, maxWeeklyHours: number, id?: string) {
  await requireRole(...ADMIN_ROLES);
  if (!designation.trim()) return { success: false as const, error: "Designation is required" };
  if (maxWeeklyHours < 1 || maxWeeklyHours > 60) return { success: false as const, error: "Hours must be 1–60" };
  const name = designation.trim();
  try {
    if (id) {
      // Editing: rename and/or change hours. If the designation string
      // changes, keep any faculty tagged with the old name in sync.
      const prev = await prisma.facultyDesignationRule.findUnique({ where: { id } });
      await prisma.facultyDesignationRule.update({ where: { id }, data: { designation: name, maxWeeklyHours } });
      if (prev && prev.designation !== name) {
        await prisma.facultyProfile.updateMany({ where: { designation: prev.designation }, data: { designation: name } });
      }
    } else {
      await prisma.facultyDesignationRule.upsert({
        where: { designation: name },
        update: { maxWeeklyHours },
        create: { designation: name, maxWeeklyHours },
      });
    }
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "A designation with that name already exists" };
  }
}

export async function deleteDesignationRule(id: string) {
  await requireRole(...ADMIN_ROLES);
  await prisma.facultyDesignationRule.delete({ where: { id } });
  revalidate();
  return { success: true as const };
}

// ─── Classrooms ─────────────────────────────────────────────────────────────

export async function listClassrooms() {
  await requireUser();
  return prisma.classroom.findMany({ orderBy: { name: "asc" } });
}

export async function saveClassroom(data: {
  id?: string;
  name: string;
  type: string;
  capacity: number;
  availableDays: string[];
}) {
  await requireRole(...ADMIN_ROLES);
  if (!(await hasSectionEdit("configuration"))) return { success: false as const, error: "Your role has view-only access to Configuration. Ask an administrator for edit access." };
  if (!data.name.trim()) return { success: false as const, error: "Room name is required" };
  const days = data.availableDays.filter((d) => DAYS.includes(d as Weekday));
  if (days.length === 0) return { success: false as const, error: "Pick at least one available day" };
  try {
    const payload = {
      name: data.name.trim(),
      type: data.type.trim() || "Lecture Hall",
      capacity: data.capacity,
      availableDays: days.join(","),
    };
    if (data.id) await prisma.classroom.update({ where: { id: data.id }, data: payload });
    else await prisma.classroom.create({ data: payload });
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "A room with this name already exists" };
  }
}

export async function deleteClassroom(id: string) {
  await requireRole(...ADMIN_ROLES);
  await prisma.classroom.delete({ where: { id } });
  revalidate();
  return { success: true as const };
}

// ─── Slot placement with live conflict validation ───────────────────────────

const SLOT_INCLUDE = {
  assignment: {
    include: {
      subject: true,
      faculty: { include: { user: { select: { name: true } } } },
    },
  },
  classroom: true,
} as const;

export async function getSectionGrid(sectionId: string) {
  await requireUser();
  const section = await prisma.programSection.findUnique({
    where: { id: sectionId },
    include: { program: true },
  });
  if (!section) return null;
  const slots = await prisma.timetableSlot.findMany({
    where: { sectionId },
    include: SLOT_INCLUDE,
  });
  return { section, slots, workingDays: workingDaysOf(section.weekStart) };
}

export async function placeSlot(data: {
  sectionId: string;
  assignmentId: string;
  classroomId: string;
  day: Weekday;
  period: number;
}) {
  await requireRole(...ADMIN_ROLES);
  if (!(await hasSectionEdit("timetable"))) return { success: false as const, error: "Your role has view-only access to the timetable. Ask an administrator for edit access." };
  const { sectionId, assignmentId, classroomId, day, period } = data;

  if (!DAYS.includes(day) || period < 1 || period > MAX_PERIOD) {
    return { success: false as const, error: "Invalid day or period" };
  }

  const [section, assignment, classroom] = await Promise.all([
    prisma.programSection.findUnique({ where: { id: sectionId } }),
    prisma.sectionCourseAssignment.findUnique({
      where: { id: assignmentId },
      include: { faculty: { include: { user: { select: { name: true } } } }, subject: true },
    }),
    prisma.classroom.findUnique({ where: { id: classroomId } }),
  ]);
  if (!section || !assignment || !classroom) return { success: false as const, error: "Invalid selection" };
  if (assignment.sectionId !== sectionId) return { success: false as const, error: "That course isn't assigned to this section" };

  // 1. Day must fall inside the section's 5-day attendance window
  if (!workingDaysOf(section.weekStart).includes(day)) {
    return { success: false as const, error: `This section attends ${workingDaysOf(section.weekStart).join("–")} — ${day} is their day off` };
  }

  // 2. Room must be available on that weekday
  if (!classroom.availableDays.split(",").includes(day)) {
    return { success: false as const, error: `${classroom.name} is not available on ${day}` };
  }

  // 3. Section must be free at that time
  const sectionClash = await prisma.timetableSlot.findFirst({
    where: { sectionId, day, period },
    include: SLOT_INCLUDE,
  });
  if (sectionClash) {
    return { success: false as const, error: `Section already has ${sectionClash.assignment.subject.code} at that time` };
  }

  // 4. Room must be free at that time
  const roomClash = await prisma.timetableSlot.findFirst({ where: { classroomId, day, period }, include: SLOT_INCLUDE });
  if (roomClash) {
    return { success: false as const, error: `${classroom.name} is occupied at that time (${roomClash.assignment.subject.code})` };
  }

  // 5. Faculty must be free at that time (across ALL sections/programmes)
  const facultyClash = await prisma.timetableSlot.findFirst({
    where: {
      day,
      period,
      assignment: { facultyProfileId: assignment.facultyProfileId },
    },
    include: { section: { include: { program: true } }, assignment: { include: { subject: true } } },
  });
  if (facultyClash) {
    return {
      success: false as const,
      error: `${assignment.faculty.user.name} already teaches ${facultyClash.assignment.subject.code} (${facultyClash.section.program.name} ${facultyClash.section.name}) at that time`,
    };
  }

  // 6. Faculty weekly hour cap (by designation rule; default 16h)
  const rule = assignment.faculty.designation
    ? await prisma.facultyDesignationRule.findUnique({ where: { designation: assignment.faculty.designation } })
    : null;
  const cap = rule?.maxWeeklyHours ?? 16;
  const currentHours = await prisma.timetableSlot.count({
    where: { assignment: { facultyProfileId: assignment.facultyProfileId } },
  });
  if (currentHours >= cap) {
    return {
      success: false as const,
      error: `${assignment.faculty.user.name} is already at their weekly cap of ${cap}h (${assignment.faculty.designation ?? "no designation"})`,
    };
  }

  const slot = await prisma.timetableSlot.create({
    data: { sectionId, assignmentId, classroomId, day, period },
    include: SLOT_INCLUDE,
  });
  revalidate();
  return { success: true as const, slot };
}

export async function removeSlot(slotId: string) {
  await requireRole(...ADMIN_ROLES);
  if (!(await hasSectionEdit("timetable"))) return { success: false as const, error: "Your role has view-only access to the timetable. Ask an administrator for edit access." };
  await prisma.timetableSlot.delete({ where: { id: slotId } });
  revalidate();
  return { success: true as const };
}

// ─── Read-only views for students & faculty ─────────────────────────────────

/** Student: grid of their section (matched via profile programme+semester+section).
 *  Faculty: all their own teaching slots. */
export async function getMyTimetable() {
  const user = await requireUser();

  if (user.role === "STUDENT") {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      include: { linkedSection: { include: { program: true, batch: { select: { label: true } } } } },
    });
    if (!profile) return { kind: "none" as const, reason: "No student profile found." };

    // Preferred: the direct section link. Fallback: legacy string matching
    // (programme name + semester + section letter) for unlinked profiles.
    let section = profile.linkedSection;
    if (!section) {
      if (!profile.program) return { kind: "none" as const, reason: "Your profile has no programme set." };
      const program = await prisma.program.findFirst({ where: { name: profile.program } });
      if (!program) return { kind: "none" as const, reason: "No timetable published for your programme yet." };
      section = await prisma.programSection.findFirst({
        where: {
          programId: program.id,
          ...(profile.currentSemester ? { semester: profile.currentSemester } : {}),
          ...(profile.section ? { name: profile.section } : {}),
        },
        include: { program: true, batch: { select: { label: true } } },
      });
    }
    if (!section) return { kind: "none" as const, reason: "No matching section found for your profile." };

    // Personal timetable = home-section classes, EXCEPT for courses where the
    // student is enrolled into a different section (electives / cross-section
    // enrollment) — those courses' classes come from the enrolled section.
    const [homeSlots, enrollments] = await Promise.all([
      prisma.timetableSlot.findMany({ where: { sectionId: section.id }, include: SLOT_INCLUDE }),
      prisma.courseEnrollment.findMany({ where: { studentProfileId: profile.id } }),
    ]);
    const overriddenSubjects = new Set(enrollments.map((e) => e.subjectId));
    let slots = homeSlots.filter((s) => !overriddenSubjects.has(s.assignment.subjectId));
    if (enrollments.length > 0) {
      const enrolledSlots = await prisma.timetableSlot.findMany({
        where: {
          OR: enrollments.map((e) => ({
            sectionId: e.sectionId,
            assignment: { subjectId: e.subjectId },
          })),
        },
        include: SLOT_INCLUDE,
      });
      slots = [...slots, ...enrolledSlots];
    }

    return {
      kind: "section" as const,
      sectionId: section.id,
      studentProfileId: profile.id,
      hasEnrollments: enrollments.length > 0,
      label: `${section.program.name} · ${section.batch.label} · Sem ${section.semester} · Section ${section.name}${enrollments.length > 0 ? ` (+${enrollments.length} elective${enrollments.length > 1 ? "s" : ""})` : ""}`,
      workingDays: workingDaysOf(section.weekStart),
      slots,
    };
  }

  if (user.role === "FACULTY") {
    const profile = await prisma.facultyProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return { kind: "none" as const, reason: "No faculty profile found." };
    const slots = await prisma.timetableSlot.findMany({
      where: { assignment: { facultyProfileId: profile.id } },
      include: { ...SLOT_INCLUDE, section: { include: { program: true } } },
    });
    return { kind: "faculty" as const, label: "My teaching schedule", workingDays: DAYS, slots };
  }

  return { kind: "none" as const, reason: "Timetables are shown for students and faculty." };
}

// ─── Planning metrics for the builder ───────────────────────────────────────

/** Resource overview for admins while placing classes: room usage, faculty
 *  allocation and how much weekly teaching capacity is still unplanned. */
export async function getTimetableMetrics() {
  await requireRole(...ADMIN_ROLES);

  const [rooms, faculty, rules, assignments, usedRoomIds] = await Promise.all([
    prisma.classroom.count(),
    prisma.facultyProfile.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.facultyDesignationRule.findMany(),
    prisma.sectionCourseAssignment.findMany({
      include: { _count: { select: { slots: true } } },
    }),
    prisma.timetableSlot.findMany({ distinct: ["classroomId"], select: { classroomId: true } }),
  ]);

  const capOf = new Map(rules.map((r) => [r.designation, r.maxWeeklyHours]));
  const DEFAULT_CAP = 16;

  const byFaculty = new Map<string, { assigned: number; placed: number }>();
  for (const a of assignments) {
    const cur = byFaculty.get(a.facultyProfileId) ?? { assigned: 0, placed: 0 };
    cur.assigned += a.weeklyHours;
    cur.placed += a._count.slots;
    byFaculty.set(a.facultyProfileId, cur);
  }

  const perFaculty = faculty.map((f) => {
    const cap = (f.designation && capOf.get(f.designation)) || DEFAULT_CAP;
    const { assigned, placed } = byFaculty.get(f.id) ?? { assigned: 0, placed: 0 };
    return {
      id: f.id,
      name: f.user.name ?? f.employeeCode,
      designation: f.designation ?? "—",
      cap,
      assigned,
      placed,
      free: Math.max(0, cap - placed),
    };
  });

  const totalCap = perFaculty.reduce((s, f) => s + f.cap, 0);
  const totalPlaced = perFaculty.reduce((s, f) => s + f.placed, 0);

  return {
    rooms: { total: rooms, used: usedRoomIds.length, idle: Math.max(0, rooms - usedRoomIds.length) },
    faculty: {
      total: faculty.length,
      unallocated: perFaculty.filter((f) => f.assigned === 0).length,
    },
    hours: { cap: totalCap, placed: totalPlaced, remaining: Math.max(0, totalCap - totalPlaced) },
    perFaculty,
  };
}

// ─── Batches (Configuration → Batches) ──────────────────────────────────────

export async function listBatches() {
  await requireUser();
  return prisma.batch.findMany({
    include: {
      program: { select: { id: true, name: true } },
      _count: { select: { students: true, sections: true } },
    },
    orderBy: [{ program: { name: "asc" } }, { label: "asc" }],
  });
}

export async function saveBatch(data: { programId: string; label: string; id?: string }) {
  await requireRole(...ADMIN_ROLES);
  if (!(await hasSectionEdit("configuration"))) return { success: false as const, error: "Your role has view-only access to Configuration. Ask an administrator for edit access." };
  if (!data.programId) return { success: false as const, error: "Pick the programme this batch belongs to" };
  const clean = data.label.trim();
  if (!/^\d{4}\s*-\s*\d{4}$/.test(clean)) {
    return { success: false as const, error: "Batch must look like 2025-2027 (start year - end year)" };
  }
  const normalized = clean.replace(/\s*-\s*/, "-");
  try {
    if (data.id) {
      await prisma.batch.update({ where: { id: data.id }, data: { label: normalized, programId: data.programId } });
    } else {
      await prisma.batch.create({ data: { label: normalized, programId: data.programId } });
    }
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "This programme already has a batch with that label" };
  }
}

export async function deleteBatch(id: string) {
  await requireRole(...ADMIN_ROLES);
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: { _count: { select: { sections: true, students: true } } },
  });
  if (!batch) return { success: false as const, error: "Batch not found" };
  if (batch._count.sections > 0 || batch._count.students > 0) {
    return {
      success: false as const,
      error: `This batch has ${batch._count.students} student(s) and ${batch._count.sections} section(s) — remove them first.`,
    };
  }
  await prisma.batch.delete({ where: { id } });
  revalidate();
  return { success: true as const };
}

// ─── Course-section rosters (enrollment) ────────────────────────────────────
// Flow: Programme → Course → Section offering that course → students.
// A student can sit in different sections for different courses, but the
// @@unique([studentProfileId, subjectId]) constraint guarantees they are in
// at most ONE section per course.

/** Sections that offer a given course (via a faculty assignment). */
export async function listSectionsOfferingCourse(subjectId: string) {
  await requireRole(...ADMIN_ROLES);
  const assignments = await prisma.sectionCourseAssignment.findMany({
    where: { subjectId },
    include: { section: { include: { program: { select: { name: true } }, batch: { select: { label: true } }, _count: { select: { courseEnrollments: true } } } } },
  });
  return assignments.map((a) => ({
    sectionId: a.sectionId,
    label: `${a.section.program.name} · ${a.section.batch.label} · Sem ${a.section.semester} · Sec ${a.section.name} (${a.section.type})`,
    enrolled: a.section._count.courseEnrollments,
    capacity: a.section.studentCount,
  }));
}

/** Roster + candidates for a course-section pair. */
export async function getSectionRoster(subjectId: string, sectionId: string) {
  await requireRole(...ADMIN_ROLES);
  const section = await prisma.programSection.findUnique({
    where: { id: sectionId },
    include: { program: true },
  });
  if (!section) return { enrolled: [], candidates: [] };

  const [enrolled, allEnrollmentsForCourse, students] = await Promise.all([
    prisma.courseEnrollment.findMany({
      where: { subjectId, sectionId },
      include: { student: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.courseEnrollment.findMany({ where: { subjectId }, select: { studentProfileId: true, sectionId: true } }),
    prisma.studentProfile.findMany({
      where: { user: { isActive: true }, OR: [{ program: section.program.name }, { linkedSection: { programId: section.programId } }] },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { rollNo: "asc" },
    }),
  ]);

  const elsewhere = new Map(allEnrollmentsForCourse.map((e) => [e.studentProfileId, e.sectionId]));
  const candidates = students
    .filter((s) => !enrolled.some((e) => e.studentProfileId === s.id))
    .map((s) => ({
      id: s.id,
      name: s.user.name ?? s.user.email,
      rollNo: s.rollNo,
      // already in another section for THIS course — moving them switches sections
      inOtherSection: elsewhere.has(s.id) && elsewhere.get(s.id) !== sectionId,
    }));

  return {
    enrolled: enrolled.map((e) => ({
      enrollmentId: e.id,
      studentProfileId: e.studentProfileId,
      name: e.student.user.name ?? e.student.user.email,
      rollNo: e.student.rollNo,
    })),
    candidates,
  };
}

/** Enroll a student into a course-section. If they are already in another
 *  section for the same course, they are MOVED (one section per course). */
export async function enrollStudent(subjectId: string, sectionId: string, studentProfileId: string) {
  await requireRole(...ADMIN_ROLES);
  if (!(await hasSectionEdit("configuration"))) return { success: false as const, error: "Your role has view-only access to Configuration. Ask an administrator for edit access." };
  const offering = await prisma.sectionCourseAssignment.findUnique({
    where: { sectionId_subjectId: { sectionId, subjectId } },
  });
  if (!offering) return { success: false as const, error: "This section does not offer that course — assign a faculty to it first (Timetable step 2)." };

  await prisma.courseEnrollment.upsert({
    where: { studentProfileId_subjectId: { studentProfileId, subjectId } },
    update: { sectionId },
    create: { studentProfileId, subjectId, sectionId },
  });
  revalidate();
  return { success: true as const };
}

export async function unenrollStudent(enrollmentId: string) {
  await requireRole(...ADMIN_ROLES);
  await prisma.courseEnrollment.delete({ where: { id: enrollmentId } }).catch(() => {});
  revalidate();
  return { success: true as const };
}

// ─── Smart placement: option availability with reasons ──────────────────────

/** For a chosen section+day+period, every course option and room option with
 *  a disabled flag and the human reason — so admins see what CANNOT be used
 *  and why, instead of discovering conflicts after clicking. */
export async function getPlacementOptions(sectionId: string, day: Weekday, period: number) {
  await requireRole(...ADMIN_ROLES);

  const [assignments, rooms, slotsAtTime, rules, assignmentFaculty, placedByAssignment] = await Promise.all([
    prisma.sectionCourseAssignment.findMany({
      where: { sectionId },
      include: {
        subject: { select: { code: true, name: true } },
        faculty: { include: { user: { select: { name: true } } } },
        _count: { select: { slots: true } },
      },
      orderBy: { subject: { code: "asc" } },
    }),
    prisma.classroom.findMany({ orderBy: { name: "asc" } }),
    prisma.timetableSlot.findMany({
      where: { day, period },
      include: {
        assignment: { include: { subject: { select: { code: true } } } },
        section: { include: { program: { select: { name: true } } } },
        classroom: { select: { id: true, name: true } },
      },
    }),
    prisma.facultyDesignationRule.findMany(),
    prisma.sectionCourseAssignment.findMany({
      select: { id: true, facultyProfileId: true, faculty: { select: { designation: true } } },
    }),
    prisma.timetableSlot.groupBy({ by: ["assignmentId"], _count: { _all: true } }),
  ]);

  const capOf = new Map(rules.map((r) => [r.designation, r.maxWeeklyHours]));
  const facultyPlaced = new Map<string, number>();
  const facultyDesignation = new Map<string, string | null>();
  for (const a of assignmentFaculty) {
    facultyDesignation.set(a.facultyProfileId, a.faculty.designation);
    const placed = placedByAssignment.find((p) => p.assignmentId === a.id)?._count._all ?? 0;
    facultyPlaced.set(a.facultyProfileId, (facultyPlaced.get(a.facultyProfileId) ?? 0) + placed);
  }
  const busyFacultyIds = new Set<string>();
  for (const s of slotsAtTime) {
    const fa = assignmentFaculty.find((a) => a.id === s.assignmentId);
    if (fa) busyFacultyIds.add(fa.facultyProfileId);
  }
  const sectionBusy = slotsAtTime.some((s) => s.sectionId === sectionId);

  const courseOptions = assignments.map((a) => {
    let reason: string | null = null;
    if (sectionBusy) {
      reason = "This section already has a class at this time";
    } else if (a._count.slots >= a.weeklyHours) {
      reason = `All ${a.weeklyHours}h already placed this week`;
    } else if (busyFacultyIds.has(a.facultyProfileId)) {
      reason = `${a.faculty.user.name ?? "Faculty"} teaches elsewhere at this time`;
    } else {
      const des = facultyDesignation.get(a.facultyProfileId);
      const cap = (des && capOf.get(des)) || 16;
      if ((facultyPlaced.get(a.facultyProfileId) ?? 0) >= cap) {
        reason = `${a.faculty.user.name ?? "Faculty"} is at their ${cap}h weekly cap`;
      }
    }
    return {
      id: a.id,
      label: `${a.subject.code} — ${a.faculty.user.name ?? "?"} (${a._count.slots}/${a.weeklyHours}h placed)`,
      disabled: !!reason,
      reason,
    };
  });

  const occupiedRooms = new Map(slotsAtTime.map((s) => [s.classroom.id, s]));
  const roomOptions = rooms.map((r) => {
    let reason: string | null = null;
    if (!r.availableDays.split(",").includes(day)) {
      reason = `Not available on ${day}`;
    } else {
      const clash = occupiedRooms.get(r.id);
      if (clash) reason = `Occupied by ${clash.assignment.subject.code} (${clash.section.program.name} ${clash.section.name})`;
    }
    return {
      id: r.id,
      label: `${r.name} · ${r.type} · ${r.capacity} seats`,
      capacity: r.capacity,
      disabled: !!reason,
      reason,
    };
  });

  return { courseOptions, roomOptions };
}
