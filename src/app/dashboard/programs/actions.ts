"use server";

import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { revalidatePath } from "next/cache";

const MANAGE_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;

function revalidate() {
  revalidatePath("/dashboard/programs");
}

// ─── Navigation data ────────────────────────────────────────────────────────

/** Programmes with their batch count and total enrolled students. */
export async function listProgramsOverview() {
  await requireRole(...MANAGE_ROLES);
  const programs = await prisma.program.findMany({
    include: {
      batches: { include: { _count: { select: { students: true, sections: true } } } },
      _count: { select: { subjects: true } },
    },
    orderBy: { name: "asc" },
  });
  return programs.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    department: p.department,
    courseCount: p._count.subjects,
    batchCount: p.batches.length,
    studentCount: p.batches.reduce((s, b) => s + b._count.students, 0),
  }));
}

/** One programme with its batches (each with roster + section counts). */
export async function getProgramDetail(programId: string) {
  await requireRole(...MANAGE_ROLES);
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      batches: {
        include: { _count: { select: { students: true, sections: true } } },
        orderBy: { label: "desc" },
      },
    },
  });
  if (!program) return null;
  return {
    id: program.id,
    name: program.name,
    batches: program.batches.map((b) => ({
      id: b.id,
      label: b.label,
      studentCount: b._count.students,
      sectionCount: b._count.sections,
    })),
  };
}

/** A batch's roster + the semesters/sections available within it. */
export async function getBatchDetail(batchId: string) {
  await requireRole(...MANAGE_ROLES);
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      program: { select: { id: true, name: true } },
      students: {
        include: { user: { select: { name: true, email: true, isActive: true } } },
        orderBy: { rollNo: "asc" },
      },
      sections: {
        include: {
          _count: { select: { memberships: true, assignments: true } },
        },
        orderBy: [{ semester: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!batch) return null;
  return {
    id: batch.id,
    label: batch.label,
    program: batch.program,
    students: batch.students.map((s) => ({
      id: s.id,
      rollNo: s.rollNo,
      name: s.user.name ?? s.user.email,
      email: s.user.email,
      isActive: s.user.isActive,
      currentSemester: s.currentSemester,
    })),
    sections: batch.sections.map((s) => ({
      id: s.id,
      semester: s.semester,
      name: s.name,
      type: s.type,
      studentCount: s.studentCount,
      enrolled: s._count.memberships,
      courseCount: s._count.assignments,
    })),
  };
}

// ─── Batch roster: add / remove students ────────────────────────────────────

/** Students not yet in ANY batch, but onboarded under THIS batch's programme
 *  — the only ones it makes sense to place here. In the normal flow (batch
 *  chosen mandatorily at onboarding) this list is only ever legacy/edge-case
 *  students who somehow ended up without a batch. */
export async function listUnbatchedStudents(batchId: string) {
  await requireRole(...MANAGE_ROLES);
  const batch = await prisma.batch.findUnique({ where: { id: batchId }, include: { program: true } });
  if (!batch) return [];
  const students = await prisma.studentProfile.findMany({
    where: {
      batchId: null,
      user: { isActive: true },
      OR: [{ program: batch.program.name }, { program: null }],
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { rollNo: "asc" },
  });
  return students.map((s) => ({
    id: s.id,
    rollNo: s.rollNo,
    name: s.user.name ?? s.user.email,
    email: s.user.email,
  }));
}

export async function addStudentsToBatch(batchId: string, studentProfileIds: string[]) {
  await requireRole(...MANAGE_ROLES);
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) return { success: false as const, error: "Batch not found" };
  if (studentProfileIds.length === 0) return { success: false as const, error: "No students selected" };

  // only unbatched students — never pull someone out of another batch
  await prisma.studentProfile.updateMany({
    where: { id: { in: studentProfileIds }, batchId: null },
    data: { batchId },
  });
  // keep the legacy display 'program' string in sync for older views
  const program = await prisma.program.findUnique({ where: { id: batch.programId } });
  if (program) {
    await prisma.studentProfile.updateMany({
      where: { id: { in: studentProfileIds }, batchId },
      data: { program: program.name },
    });
  }
  revalidate();
  return { success: true as const };
}

/** Remove a student from a batch. Blocked if they still have course
 *  enrollments in this batch's sections (unenroll them first). */
export async function removeStudentFromBatch(batchId: string, studentProfileId: string) {
  await requireRole(...MANAGE_ROLES);
  const enrollments = await prisma.courseEnrollment.count({
    where: { studentProfileId, section: { batchId } },
  });
  if (enrollments > 0) {
    return { success: false as const, error: `This student is still enrolled in ${enrollments} course(s) in this batch — remove them from those sections first.` };
  }
  await prisma.studentProfile.update({
    where: { id: studentProfileId },
    data: { batchId: null, sectionId: null },
  });
  revalidate();
  return { success: true as const };
}

// ─── CSV bulk ASSIGN (no account creation) ──────────────────────────────────
// Accounts are created in User Management (individually or via its own CSV
// bulk-onboard). This CSV only PLACES already-onboarded students into this
// batch, matching rows by roll number. Students already in another batch are
// skipped with the reason — moving between batches stays a manual decision.

type AssignCsvRow = { rollNo: string };

export async function assignStudentsCsv(batchId: string, rows: AssignCsvRow[]) {
  await requireRole(...MANAGE_ROLES);
  const batch = await prisma.batch.findUnique({ where: { id: batchId }, include: { program: true } });
  if (!batch) return { ok: 0, failed: [], error: "Batch not found" };
  if (rows.length === 0) return { ok: 0, failed: [], error: "The file had no data rows" };
  if (rows.length > 2000) return { ok: 0, failed: [], error: "Please import at most 2000 rows at a time" };

  const failed: { row: number; rollNo: string; reason: string }[] = [];
  let ok = 0;

  // One prefetch for all roll numbers instead of a query per row
  const rolls = rows.map((r) => (r.rollNo || "").trim()).filter(Boolean);
  const students = await prisma.studentProfile.findMany({
    where: { rollNo: { in: rolls } },
    include: { batch: { include: { program: true } } },
  });
  const byRoll = new Map(students.map((s) => [s.rollNo, s]));
  const toAssign: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const line = i + 2;
    const rollNo = (rows[i].rollNo || "").trim();
    if (!rollNo) { failed.push({ row: line, rollNo, reason: "Missing roll number" }); continue; }

    const student = byRoll.get(rollNo);
    if (!student) {
      failed.push({ row: line, rollNo, reason: "No onboarded student with this roll number — onboard them in User Management first" });
      continue;
    }
    if (student.batchId === batchId) { ok++; continue; } // already here — fine
    if (student.batchId) {
      failed.push({ row: line, rollNo, reason: `Already in ${student.batch?.program.name ?? "another programme"} ${student.batch?.label ?? ""} — remove them there first to move them` });
      continue;
    }
    if (student.program && student.program.toLowerCase() !== batch.program.name.toLowerCase()) {
      failed.push({ row: line, rollNo, reason: `Onboarded under "${student.program}", not "${batch.program.name}"` });
      continue;
    }
    toAssign.push(student.id);
    ok++;
  }

  if (toAssign.length > 0) {
    await prisma.studentProfile.updateMany({
      where: { id: { in: toAssign } },
      data: { batchId, program: batch.program.name },
    });
  }

  revalidate();
  return { ok, failed, error: null as string | null };
}

// ─── Student-centric section placement (from the Roster) ────────────────────

/** For ONE student: every section in their batch (grouped by semester), each
 *  flagged with whether the student is currently enrolled in it. Powers the
 *  roster's "Assign sections" dialog — one core section + any number of
 *  elective sections per semester. */
export async function getStudentSectionPlacement(studentProfileId: string) {
  await requireRole(...MANAGE_ROLES);
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: { user: { select: { name: true } } },
  });
  if (!student || !student.batchId) return null;

  const [sections, memberships] = await Promise.all([
    prisma.programSection.findMany({
      where: { batchId: student.batchId },
      include: { _count: { select: { assignments: true } } },
      orderBy: [{ semester: "asc" }, { name: "asc" }],
    }),
    prisma.sectionMembership.findMany({
      where: { studentProfileId },
      select: { sectionId: true },
    }),
  ]);
  const enrolledSectionIds = new Set(memberships.map((m) => m.sectionId));

  return {
    studentProfileId,
    name: student.user.name ?? student.rollNo ?? "Student",
    rollNo: student.rollNo,
    sections: sections.map((s) => ({
      id: s.id,
      semester: s.semester,
      name: s.name,
      type: s.type,
      courseCount: s._count.assignments,
      enrolled: enrolledSectionIds.has(s.id),
    })),
  };
}

// ─── Section enrollment within a batch ──────────────────────────────────────

/** For a section: its courses, current roster per course, and the batch
 *  students available to add. Core sections enroll a student into ALL the
 *  section's courses at once; electives enroll per course. */
export async function getSectionEnrollment(sectionId: string) {
  await requireRole(...MANAGE_ROLES);
  const section = await prisma.programSection.findUnique({
    where: { id: sectionId },
    include: {
      batch: { select: { id: true, label: true } },
      program: { select: { name: true } },
      assignments: {
        include: {
          subject: { select: { id: true, code: true, name: true } },
          faculty: { include: { user: { select: { name: true } } } },
        },
        orderBy: { subject: { code: "asc" } },
      },
    },
  });
  if (!section) return null;

  const subjectIds = section.assignments.map((a) => a.subjectId);

  // Members of THIS section (the roster) — membership is the placement fact,
  // independent of whether the section has courses yet.
  const members = await prisma.sectionMembership.findMany({
    where: { sectionId },
    include: { student: { include: { user: { select: { name: true } } } } },
  });

  // The batch roster (candidates)
  const batchStudents = await prisma.studentProfile.findMany({
    where: { batchId: section.batchId, user: { isActive: true } },
    include: { user: { select: { name: true } } },
    orderBy: { rollNo: "asc" },
  });

  // How many of this section's courses each member is actually enrolled in
  const memberEnrollments = subjectIds.length
    ? await prisma.courseEnrollment.findMany({ where: { sectionId, subjectId: { in: subjectIds } }, select: { studentProfileId: true, subjectId: true } })
    : [];
  const enrolledCount = new Map<string, number>();
  for (const e of memberEnrollments) enrolledCount.set(e.studentProfileId, (enrolledCount.get(e.studentProfileId) ?? 0) + 1);

  // Where each batch student currently sits for each of these courses (to warn on swaps)
  const otherEnrollments = subjectIds.length
    ? await prisma.courseEnrollment.findMany({
        where: { subjectId: { in: subjectIds }, student: { batchId: section.batchId } },
        include: { section: { select: { id: true, name: true } } },
      })
    : [];

  const memberIds = new Set(members.map((m) => m.studentProfileId));
  const roster = members.map((m) => ({
    studentProfileId: m.studentProfileId,
    name: m.student.user.name ?? m.student.rollNo ?? "Unknown",
    rollNo: m.student.rollNo,
    courseCount: enrolledCount.get(m.studentProfileId) ?? 0,
    ofCourses: subjectIds.length,
  })).sort((a, b) => (a.rollNo ?? "").localeCompare(b.rollNo ?? ""));

  const candidates = batchStudents
    .filter((s) => !memberIds.has(s.id))
    .map((s) => {
      // Which of this section's courses is the student already taking elsewhere?
      const clashes = otherEnrollments.filter((e) => e.studentProfileId === s.id && e.sectionId !== sectionId);
      return {
        studentProfileId: s.id,
        name: s.user.name ?? s.rollNo ?? "Unknown",
        rollNo: s.rollNo,
        movesFrom: clashes.length > 0 ? [...new Set(clashes.map((c) => c.section.name))].join(", ") : null,
      };
    });

  return {
    id: section.id,
    label: `${section.program.name} · ${section.batch.label} · Sem ${section.semester} · Sec ${section.name}`,
    type: section.type,
    batchId: section.batchId,
    courses: section.assignments.map((a) => ({
      subjectId: a.subjectId,
      code: a.subject.code,
      name: a.subject.name,
      faculty: a.faculty.user.name,
    })),
    roster,
    candidates,
  };
}

/** Enroll a student into a section. For CORE/MIXED sections this enrolls them
 *  into every course the section offers (moving them off any other section for
 *  those courses). For ELECTIVE sections, into each offered course too — the
 *  unique(student,subject) constraint keeps "one section per course". */
export async function enrollStudentInSection(sectionId: string, studentProfileId: string) {
  return enrollStudentsInSection(sectionId, [studentProfileId]);
}

/** Place (or move) many students into a section. Section membership is
 *  recorded even if the section has NO courses yet — course enrollments are
 *  created for whatever courses exist now, and auto-created later when more
 *  courses are attached. Joining a CORE/MIXED section switches the student out
 *  of any other core section in the same semester. */
export async function enrollStudentsInSection(sectionId: string, studentProfileIds: string[]) {
  await requireRole(...MANAGE_ROLES);
  const ids = [...new Set(studentProfileIds)].filter(Boolean);
  if (ids.length === 0) return { success: false as const, error: "No students selected" };

  const section = await prisma.programSection.findUnique({
    where: { id: sectionId },
    include: { assignments: { select: { subjectId: true } } },
  });
  if (!section) return { success: false as const, error: "Section not found" };

  // Every student must belong to this section's batch
  const students = await prisma.studentProfile.findMany({ where: { id: { in: ids } }, select: { id: true, batchId: true } });
  const valid = students.filter((s) => s.batchId === section.batchId).map((s) => s.id);
  const wrongBatch = ids.length - valid.length;
  if (valid.length === 0) return { success: false as const, error: "None of the selected students are in this batch." };

  const isCore = section.type === "CORE" || section.type === "MIXED";

  // For a CORE move: find the other core sections in this batch+semester so we
  // can drop the student's membership + enrollments there (clean switch).
  const otherCoreSections = isCore
    ? await prisma.programSection.findMany({
        where: { batchId: section.batchId, semester: section.semester, type: { in: ["CORE", "MIXED"] }, id: { not: sectionId } },
        include: { assignments: { select: { subjectId: true } } },
      })
    : [];
  const otherCoreIds = otherCoreSections.map((s) => s.id);
  const otherCoreSubjectIds = otherCoreSections.flatMap((s) => s.assignments.map((a) => a.subjectId));

  await prisma.$transaction([
    // drop previous core membership/enrollments in this semester
    ...(otherCoreIds.length
      ? [
          prisma.sectionMembership.deleteMany({ where: { studentProfileId: { in: valid }, sectionId: { in: otherCoreIds } } }),
          prisma.courseEnrollment.deleteMany({ where: { studentProfileId: { in: valid }, sectionId: { in: otherCoreIds }, subjectId: { in: otherCoreSubjectIds } } }),
        ]
      : []),
    // record membership in the new section
    ...valid.map((studentProfileId) =>
      prisma.sectionMembership.upsert({
        where: { studentProfileId_sectionId: { studentProfileId, sectionId } },
        update: {},
        create: { studentProfileId, sectionId },
      })
    ),
    // enroll into the section's current courses (moving them for those courses)
    ...valid.flatMap((studentProfileId) =>
      section.assignments.map((a) =>
        prisma.courseEnrollment.upsert({
          where: { studentProfileId_subjectId: { studentProfileId, subjectId: a.subjectId } },
          update: { sectionId },
          create: { studentProfileId, subjectId: a.subjectId, sectionId },
        })
      )
    ),
  ]);

  if (isCore) {
    await prisma.studentProfile.updateMany({
      where: { id: { in: valid } },
      data: { sectionId, currentSemester: section.semester },
    });
  }
  revalidate();
  return { success: true as const, enrolled: valid.length, skipped: wrongBatch };
}

/** Enroll students into a section from a CSV roll-number list (scoped to the
 *  batch). Returns a per-row report. */
export async function enrollStudentsCsvIntoSection(sectionId: string, rollNumbers: string[]) {
  await requireRole(...MANAGE_ROLES);
  const section = await prisma.programSection.findUnique({
    where: { id: sectionId },
    include: { batch: { select: { label: true } } },
  });
  if (!section) return { ok: 0, failed: [], error: "Section not found" };

  const rolls = [...new Set(rollNumbers.map((r) => r.trim()).filter(Boolean))];
  if (rolls.length === 0) return { ok: 0, failed: [], error: "No roll numbers found in the file" };

  // Prefetch all matching students in this batch in one query
  const students = await prisma.studentProfile.findMany({
    where: { rollNo: { in: rolls } },
    select: { id: true, rollNo: true, batchId: true },
  });
  const byRoll = new Map(students.map((s) => [s.rollNo, s]));

  const failed: { row: number; rollNo: string; reason: string }[] = [];
  const toEnroll: string[] = [];
  rolls.forEach((rollNo, i) => {
    const s = byRoll.get(rollNo);
    if (!s) { failed.push({ row: i + 2, rollNo, reason: "No student with this roll number" }); return; }
    if (s.batchId !== section.batchId) { failed.push({ row: i + 2, rollNo, reason: "Not in this batch" }); return; }
    toEnroll.push(s.id);
  });

  let ok = 0;
  if (toEnroll.length > 0) {
    const res = await enrollStudentsInSection(sectionId, toEnroll);
    if (res.success) ok = res.enrolled;
  }
  revalidate();
  return { ok, failed, error: null as string | null };
}

/** Remove a student from a section — drops their membership and any course
 *  enrollments tied to that section (and clears the home link if it pointed
 *  here). */
export async function removeStudentFromSection(sectionId: string, studentProfileId: string) {
  await requireRole(...MANAGE_ROLES);
  const exists = await prisma.programSection.count({ where: { id: sectionId } });
  if (!exists) return { success: false as const, error: "Section not found" };
  await prisma.$transaction([
    prisma.sectionMembership.deleteMany({ where: { studentProfileId, sectionId } }),
    prisma.courseEnrollment.deleteMany({ where: { studentProfileId, sectionId } }),
    prisma.studentProfile.updateMany({ where: { id: studentProfileId, sectionId }, data: { sectionId: null } }),
  ]);
  revalidate();
  return { success: true as const };
}

// ─── Programme courses (imported copies from the Course Master) ─────────────

export async function listProgramCourses(programId: string) {
  await requireRole(...MANAGE_ROLES);
  return prisma.subject.findMany({
    where: { programId },
    include: {
      courseMaster: { select: { id: true, name: true, credits: true } },
      _count: { select: { sectionAssignments: true, courseEnrollments: true } },
    },
    orderBy: { code: "asc" },
  });
}

/** Update the semester of a programme's course copy (its identity fields are
 *  refreshed from the master via re-import instead). */
export async function setCourseSemester(subjectId: string, semester: number | null) {
  await requireRole(...MANAGE_ROLES);
  if (semester != null && (semester < 1 || semester > 12)) {
    return { success: false as const, error: "Semester must be 1–12" };
  }
  await prisma.subject.update({ where: { id: subjectId }, data: { semester } });
  revalidate();
  return { success: true as const };
}

/** Edit a programme's OWN copy of a course (code, name, credits, semester).
 *  These edits are local to the programme — the Course Master and other
 *  programmes' copies are never touched. Code stays unique within the
 *  programme. */
export async function updateProgramCourse(subjectId: string, data: {
  code: string; name: string; credits: number; semester: number | null;
}) {
  await requireRole(...MANAGE_ROLES);
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();
  if (!code) return { success: false as const, error: "Course code is required" };
  if (!name) return { success: false as const, error: "Course name is required" };
  if (data.credits < 0 || data.credits > 40) return { success: false as const, error: "Credits must be 0–40" };
  if (data.semester != null && (data.semester < 1 || data.semester > 12)) {
    return { success: false as const, error: "Semester must be 1–12" };
  }
  try {
    await prisma.subject.update({
      where: { id: subjectId },
      data: { code, name, credits: data.credits, semester: data.semester },
    });
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "This programme already has another course with that code" };
  }
}

// ─── Sections: create/edit inside the batch page (from Section Labels) ──────

export async function saveBatchSection(data: {
  id?: string;
  batchId: string;
  labelId: string;
  semester: number;
  type: "CORE" | "ELECTIVE" | "MIXED";
  studentCount: number;
  weekStart: string;
}) {
  await requireRole(...MANAGE_ROLES);
  const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  if (!data.labelId) return { success: false as const, error: "Pick a section label (create them in Configuration → Section Labels)" };
  if (!DAYS.includes(data.weekStart)) return { success: false as const, error: "Invalid week start" };
  if (data.semester < 1 || data.semester > 12) return { success: false as const, error: "Semester must be 1–12" };

  const [batch, label] = await Promise.all([
    prisma.batch.findUnique({ where: { id: data.batchId } }),
    prisma.sectionLabel.findUnique({ where: { id: data.labelId } }),
  ]);
  if (!batch) return { success: false as const, error: "Batch not found" };
  if (!label) return { success: false as const, error: "Section label not found" };

  try {
    const payload = {
      programId: batch.programId,
      batchId: data.batchId,
      labelId: data.labelId,
      name: label.name,
      semester: data.semester,
      type: data.type,
      studentCount: data.studentCount,
      weekStart: data.weekStart,
    };
    if (data.id) await prisma.programSection.update({ where: { id: data.id }, data: payload });
    else await prisma.programSection.create({ data: payload });
    revalidate();
    return { success: true as const };
  } catch {
    return { success: false as const, error: `Section "${label.name}" already exists for this batch & semester` };
  }
}

export async function deleteBatchSection(sectionId: string) {
  await requireRole(...MANAGE_ROLES);
  const counts = await prisma.programSection.findUnique({
    where: { id: sectionId },
    include: { _count: { select: { memberships: true, slots: true } } },
  });
  if (!counts) return { success: false as const, error: "Section not found" };
  if (counts._count.memberships > 0) {
    return { success: false as const, error: `${counts._count.memberships} student(s) are in this section — remove them first.` };
  }
  await prisma.programSection.delete({ where: { id: sectionId } });
  revalidate();
  return { success: true as const };
}

/** Assign (or change) the faculty who teaches a course in a section, with
 *  cumulative weekly-hour cap enforcement across all their assignments. */
export async function saveSectionCourseFaculty(data: {
  sectionId: string;
  subjectId: string;
  facultyProfileId: string;
  weeklyHours: number;
}) {
  await requireRole(...MANAGE_ROLES);
  if (data.weeklyHours < 1 || data.weeklyHours > 20) {
    return { success: false as const, error: "Weekly hours must be 1–20" };
  }
  const faculty = await prisma.facultyProfile.findUnique({
    where: { id: data.facultyProfileId },
    include: { user: { select: { name: true } }, teachingAssignments: { select: { sectionId: true, subjectId: true, weeklyHours: true } } },
  });
  if (!faculty) return { success: false as const, error: "Faculty member not found" };

  const rule = faculty.designation
    ? await prisma.facultyDesignationRule.findUnique({ where: { designation: faculty.designation } })
    : null;
  const cap = rule?.maxWeeklyHours ?? 16;
  const otherHours = faculty.teachingAssignments
    .filter((a) => !(a.sectionId === data.sectionId && a.subjectId === data.subjectId))
    .reduce((s, a) => s + a.weeklyHours, 0);
  if (otherHours + data.weeklyHours > cap) {
    return {
      success: false as const,
      error: `${faculty.user.name ?? "This faculty"} already has ${otherHours}h/week assigned — adding ${data.weeklyHours}h would exceed their ${cap}h cap (${faculty.designation ?? "default"}).`,
    };
  }

  await prisma.sectionCourseAssignment.upsert({
    where: { sectionId_subjectId: { sectionId: data.sectionId, subjectId: data.subjectId } },
    update: { facultyProfileId: data.facultyProfileId, weeklyHours: data.weeklyHours },
    create: data,
  });

  // Auto-enroll this section's existing members into the newly-attached course
  // (so "place students first, add courses later" just works). The
  // unique(student, subject) constraint moves anyone already taking it elsewhere.
  const members = await prisma.sectionMembership.findMany({
    where: { sectionId: data.sectionId },
    select: { studentProfileId: true },
  });
  if (members.length > 0) {
    await prisma.$transaction(
      members.map((m) =>
        prisma.courseEnrollment.upsert({
          where: { studentProfileId_subjectId: { studentProfileId: m.studentProfileId, subjectId: data.subjectId } },
          update: { sectionId: data.sectionId },
          create: { studentProfileId: m.studentProfileId, subjectId: data.subjectId, sectionId: data.sectionId },
        })
      )
    );
  }
  revalidate();
  return { success: true as const };
}

export async function removeSectionCourse(assignmentId: string) {
  await requireRole(...MANAGE_ROLES);
  await prisma.sectionCourseAssignment.delete({ where: { id: assignmentId } }).catch(() => {});
  revalidate();
  return { success: true as const };
}

/** Faculty options for assignment dropdowns (with load + cap info). */
export async function listFacultyOptions() {
  await requireRole(...MANAGE_ROLES);
  const [faculty, rules] = await Promise.all([
    prisma.facultyProfile.findMany({
      include: {
        user: { select: { name: true, isActive: true } },
        teachingAssignments: { select: { weeklyHours: true } },
      },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.facultyDesignationRule.findMany(),
  ]);
  const capOf = new Map(rules.map((r) => [r.designation, r.maxWeeklyHours]));
  return faculty
    .filter((f) => f.user.isActive)
    .map((f) => ({
      id: f.id,
      name: f.user.name ?? f.employeeCode ?? "Unknown",
      designation: f.designation,
      assigned: f.teachingAssignments.reduce((s, a) => s + a.weeklyHours, 0),
      cap: (f.designation && capOf.get(f.designation)) || 16,
    }));
}

// ─── Batch analytics (attendance & performance drill-down) ──────────────────

export async function getBatchAnalytics(batchId: string) {
  await requireRole(...MANAGE_ROLES);
  const sections = await prisma.programSection.findMany({
    where: { batchId },
    include: {
      assignments: {
        include: {
          subject: { select: { id: true, code: true, name: true } },
          faculty: { include: { user: { select: { name: true } } } },
          sessions: { include: { records: { select: { status: true } } } },
        },
      },
    },
    orderBy: [{ semester: "asc" }, { name: "asc" }],
  });

  const subjectIds = [...new Set(sections.flatMap((s) => s.assignments.map((a) => a.subject.id)))];
  const marks = subjectIds.length
    ? await prisma.marks.groupBy({
        by: ["subjectId"],
        where: { subjectId: { in: subjectIds }, student: { batchId } },
        _avg: { totalMarks: true, gradePoint: true },
        _count: { _all: true },
      })
    : [];
  const marksBySubject = new Map(marks.map((m) => [m.subjectId, m]));

  return sections.map((s) => ({
    sectionId: s.id,
    name: s.name,
    semester: s.semester,
    type: s.type,
    courses: s.assignments.map((a) => {
      const allRecords = a.sessions.flatMap((x) => x.records);
      const present = allRecords.filter((r) => r.status !== "ABSENT").length;
      const m = marksBySubject.get(a.subject.id);
      return {
        code: a.subject.code,
        name: a.subject.name,
        faculty: a.faculty.user.name,
        sessions: a.sessions.length,
        attendancePct: allRecords.length > 0 ? Math.round((present / allRecords.length) * 100) : null,
        avgMarks: m?._avg.totalMarks != null ? Math.round(m._avg.totalMarks * 10) / 10 : null,
        avgGradePoint: m?._avg.gradePoint != null ? Math.round(m._avg.gradePoint * 100) / 100 : null,
        gradedStudents: m?._count._all ?? 0,
      };
    }),
  }));
}
