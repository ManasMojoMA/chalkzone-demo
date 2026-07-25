"use server";

import { hasSectionEdit } from "@/app/dashboard/admin/permissions/actions";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionStudentProfile, requireRole, requireUser } from "@/lib/session";

// ─── Student view (reads the roll-up cache, fed by sessions) ────────────────

export async function getStudentAttendance() {
  const profile = await getSessionStudentProfile();
  if (!profile) return [];
  return prisma.attendance.findMany({
    where: { studentProfileId: profile.id },
    include: { subject: true },
    orderBy: { subject: { code: "asc" } },
  });
}

/** Per-session detail for one of the student's subjects. */
export async function getMyAttendanceDetail(subjectId: string) {
  const profile = await getSessionStudentProfile();
  if (!profile) return [];
  const records = await prisma.sessionAttendance.findMany({
    where: { studentProfileId: profile.id, session: { assignment: { subjectId } } },
    include: { session: { select: { date: true, period: true, topic: true } } },
    orderBy: { session: { date: "desc" } },
  });
  return records.map((r) => ({
    date: r.session.date,
    period: r.session.period,
    topic: r.session.topic,
    status: r.status,
  }));
}

// ─── Faculty / admin: which course-sections can I mark? ─────────────────────

export async function getTeachableCourses() {
  const user = await requireRole("FACULTY", "ADMIN", "SUPER_ADMIN");

  const where =
    user.role === "FACULTY"
      ? { faculty: { userId: user.id } }
      : {}; // admins can mark any course-section

  const assignments = await prisma.sectionCourseAssignment.findMany({
    where,
    include: {
      subject: { select: { code: true, name: true } },
      faculty: { include: { user: { select: { name: true } } } },
      section: {
        include: {
          program: { select: { name: true } },
          batch: { select: { label: true } },
          _count: { select: { courseEnrollments: true } },
        },
      },
      _count: { select: { sessions: true } },
    },
    orderBy: [{ subject: { code: "asc" } }],
  });

  return assignments.map((a) => ({
    assignmentId: a.id,
    subjectCode: a.subject.code,
    subjectName: a.subject.name,
    faculty: a.faculty.user.name,
    sectionLabel: `${a.section.program.name} · ${a.section.batch.label} · Sem ${a.section.semester} · Sec ${a.section.name}`,
    enrolled: a.section._count.courseEnrollments,
    sessionCount: a._count.sessions,
  }));
}

/** Past sessions for a course-section, most recent first. */
export async function listSessions(assignmentId: string) {
  await requireRole("FACULTY", "ADMIN", "SUPER_ADMIN");
  const sessions = await prisma.classSession.findMany({
    where: { assignmentId },
    include: { _count: { select: { records: true } }, records: { where: { status: { not: "ABSENT" } }, select: { id: true } } },
    orderBy: { date: "desc" },
  });
  return sessions.map((s) => ({
    id: s.id,
    date: s.date,
    period: s.period,
    topic: s.topic,
    present: s.records.length,
    total: s._count.records,
  }));
}

/** The roster to mark for a given course-section on a date+period. Loads any
 *  existing marks so re-opening a session shows what was saved. */
export async function getSessionRoster(assignmentId: string, dateISO: string, period: number) {
  await requireRole("FACULTY", "ADMIN", "SUPER_ADMIN");
  const assignment = await prisma.sectionCourseAssignment.findUnique({
    where: { id: assignmentId },
    include: { section: { select: { id: true } } },
  });
  if (!assignment) return { students: [], sessionId: null };

  const date = new Date(dateISO);

  const [enrolled, existing] = await Promise.all([
    prisma.courseEnrollment.findMany({
      where: { subjectId: assignment.subjectId, sectionId: assignment.sectionId },
      include: { student: { include: { user: { select: { name: true } } } } },
    }),
    prisma.classSession.findUnique({
      where: { assignmentId_date_period: { assignmentId, date, period } },
      include: { records: true },
    }),
  ]);

  const marks = new Map((existing?.records ?? []).map((r) => [r.studentProfileId, r.status]));

  const students = enrolled
    .map((e) => ({
      studentProfileId: e.studentProfileId,
      name: e.student.user.name ?? e.student.rollNo ?? "Unknown",
      rollNo: e.student.rollNo,
      status: marks.get(e.studentProfileId) ?? "PRESENT",
    }))
    .sort((a, b) => (a.rollNo ?? "").localeCompare(b.rollNo ?? ""));

  return { students, sessionId: existing?.id ?? null };
}

/** Create or update a session and its per-student marks, then refresh the
 *  aggregate Attendance cache for every affected student. */
export async function saveSession(data: {
  assignmentId: string;
  dateISO: string;
  period: number;
  topic?: string;
  marks: { studentProfileId: string; status: string }[];
}) {
  await requireRole("FACULTY", "ADMIN", "SUPER_ADMIN");
  if (!(await hasSectionEdit("attendance"))) return { success: false as const, error: "Your role has view-only access to attendance." };

  const assignment = await prisma.sectionCourseAssignment.findUnique({
    where: { id: data.assignmentId },
    include: { section: { select: { semester: true } } },
  });
  if (!assignment) return { success: false as const, error: "Course-section not found" };

  const date = new Date(data.dateISO);
  if (isNaN(date.getTime())) return { success: false as const, error: "Pick a valid date" };

  const session = await prisma.classSession.upsert({
    where: { assignmentId_date_period: { assignmentId: data.assignmentId, date, period: data.period } },
    update: { topic: data.topic?.trim() || null },
    create: { assignmentId: data.assignmentId, date, period: data.period, topic: data.topic?.trim() || null },
  });

  // Replace this session's marks
  await prisma.$transaction([
    prisma.sessionAttendance.deleteMany({ where: { sessionId: session.id } }),
    prisma.sessionAttendance.createMany({
      data: data.marks.map((m) => ({
        sessionId: session.id,
        studentProfileId: m.studentProfileId,
        status: m.status === "ABSENT" || m.status === "LATE" ? m.status : "PRESENT",
      })),
    }),
  ]);

  await recomputeAttendanceCache(assignment.subjectId, assignment.section.semester, data.marks.map((m) => m.studentProfileId));

  revalidatePath("/dashboard/attendance");
  return { success: true as const, sessionId: session.id };
}

export async function deleteSession(sessionId: string) {
  await requireRole("FACULTY", "ADMIN", "SUPER_ADMIN");
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: { assignment: { include: { section: { select: { semester: true } } } }, records: { select: { studentProfileId: true } } },
  });
  if (!session) return { success: false as const, error: "Session not found" };
  const affected = session.records.map((r) => r.studentProfileId);
  await prisma.classSession.delete({ where: { id: sessionId } });
  await recomputeAttendanceCache(session.assignment.subjectId, session.assignment.section.semester, affected);
  revalidatePath("/dashboard/attendance");
  return { success: true as const };
}

/** Recompute the aggregate Attendance row (total/attended/percentage) for each
 *  affected student in a subject, straight from their SessionAttendance rows. */
async function recomputeAttendanceCache(subjectId: string, semester: number, studentProfileIds: string[]) {
  for (const studentProfileId of [...new Set(studentProfileIds)]) {
    const records = await prisma.sessionAttendance.findMany({
      where: { studentProfileId, session: { assignment: { subjectId } } },
      select: { status: true },
    });
    const total = records.length;
    const attended = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
    const percentage = total > 0 ? (attended / total) * 100 : 0;
    if (total === 0) {
      await prisma.attendance.deleteMany({ where: { studentProfileId, subjectId, semester } });
    } else {
      await prisma.attendance.upsert({
        where: { studentProfileId_subjectId_semester: { studentProfileId, subjectId, semester } },
        update: { totalClasses: total, attendedClasses: attended, percentage },
        create: { studentProfileId, subjectId, semester, totalClasses: total, attendedClasses: attended, percentage },
      });
    }
  }
}
