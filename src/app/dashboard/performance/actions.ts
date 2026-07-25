"use server";

import { hasSectionEdit } from "@/app/dashboard/admin/permissions/actions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/session";
import { updateMarksSchema } from "@/lib/validations";

// ─── Student view ───────────────────────────────────────────────────────────

export async function getStudentPerformance() {
  const user = await requireUser();
  const student = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: {
      marks: {
        include: { subject: true },
        orderBy: [{ semester: "asc" }, { subject: { code: "asc" } }],
      },
    },
  });

  if (!student) return null;

  return {
    cgpa: student.cgpa,
    marks: student.marks,
  };
}

// ─── Faculty / admin: marks entry on enrollment rosters ─────────────────────

/** Course-sections the caller can grade: their own for faculty, all for
 *  admins — the same scoping as session attendance. */
export async function getGradableCourses() {
  const user = await requireRole("FACULTY", "ADMIN", "SUPER_ADMIN");
  const where = user.role === "FACULTY" ? { faculty: { userId: user.id } } : {};

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
  }));
}

/** The enrolled students of a course-section, with their current marks (if
 *  any) — the grading sheet. */
export async function getMarksRoster(assignmentId: string) {
  await requireRole("FACULTY", "ADMIN", "SUPER_ADMIN");
  const assignment = await prisma.sectionCourseAssignment.findUnique({
    where: { id: assignmentId },
    include: { section: { select: { semester: true } } },
  });
  if (!assignment) return { students: [], semester: 0 };

  const [enrolled, existing] = await Promise.all([
    prisma.courseEnrollment.findMany({
      where: { subjectId: assignment.subjectId, sectionId: assignment.sectionId },
      include: { student: { include: { user: { select: { name: true } } } } },
    }),
    prisma.marks.findMany({
      where: { subjectId: assignment.subjectId, semester: assignment.section.semester },
      select: { studentProfileId: true, internalMarks: true, externalMarks: true, practicalMarks: true, totalMarks: true, grade: true },
    }),
  ]);
  const byStudent = new Map(existing.map((m) => [m.studentProfileId, m]));

  const students = enrolled
    .map((e) => {
      const m = byStudent.get(e.studentProfileId);
      return {
        studentProfileId: e.studentProfileId,
        name: e.student.user.name ?? e.student.rollNo ?? "Unknown",
        rollNo: e.student.rollNo,
        internalMarks: m?.internalMarks ?? 0,
        externalMarks: m?.externalMarks ?? 0,
        practicalMarks: m?.practicalMarks ?? 0,
        totalMarks: m?.totalMarks ?? null,
        grade: m?.grade ?? null,
      };
    })
    .sort((a, b) => (a.rollNo ?? "").localeCompare(b.rollNo ?? ""));

  return { students, semester: assignment.section.semester };
}

function gradeOf(total: number): { grade: string; gradePoint: number } {
  if (total >= 90) return { grade: "O", gradePoint: 10 };
  if (total >= 80) return { grade: "A+", gradePoint: 9 };
  if (total >= 70) return { grade: "A", gradePoint: 8 };
  if (total >= 60) return { grade: "B+", gradePoint: 7 };
  if (total >= 50) return { grade: "B", gradePoint: 6 };
  return { grade: "F", gradePoint: 0 };
}

/** Save one enrolled student's marks for a course-section (upsert), then
 *  refresh their credit-weighted CGPA. */
export async function saveStudentMarks(
  assignmentId: string,
  studentProfileId: string,
  internalMarks: number,
  externalMarks: number,
  practicalMarks: number
) {
  await requireRole("FACULTY", "ADMIN", "SUPER_ADMIN");
  if (!(await hasSectionEdit("performance"))) {
    return { success: false as const, error: "Your role has view-only access to this section. Ask an administrator for edit access." };
  }

  const parsed = updateMarksSchema.safeParse({ internalMarks, externalMarks, practicalMarks });
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues?.[0]?.message || parsed.error.message };
  }

  const assignment = await prisma.sectionCourseAssignment.findUnique({
    where: { id: assignmentId },
    include: { section: { select: { semester: true } } },
  });
  if (!assignment) return { success: false as const, error: "Course-section not found" };

  // Only enrolled students of THIS section can be graded here
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { studentProfileId_subjectId: { studentProfileId, subjectId: assignment.subjectId } },
  });
  if (!enrollment || enrollment.sectionId !== assignment.sectionId) {
    return { success: false as const, error: "This student isn't enrolled in this course-section." };
  }

  const totalMarks = internalMarks + externalMarks + practicalMarks;
  if (totalMarks > 100) return { success: false as const, error: "Total marks cannot exceed 100." };
  const { grade, gradePoint } = gradeOf(totalMarks);
  const semester = assignment.section.semester;

  await prisma.marks.upsert({
    where: { studentProfileId_subjectId_semester: { studentProfileId, subjectId: assignment.subjectId, semester } },
    update: { internalMarks, externalMarks, practicalMarks, totalMarks, grade, gradePoint },
    create: { studentProfileId, subjectId: assignment.subjectId, semester, internalMarks, externalMarks, practicalMarks, totalMarks, grade, gradePoint },
  });

  // CGPA = Σ(credits × gradePoint) / Σ(credits), weighted by subject credits
  const allMarks = await prisma.marks.findMany({
    where: { studentProfileId },
    include: { subject: { select: { credits: true } } },
  });
  const totalCredits = allMarks.reduce((acc, m) => acc + m.subject.credits, 0);
  const totalPoints = allMarks.reduce((acc, m) => acc + m.subject.credits * m.gradePoint, 0);
  await prisma.studentProfile.update({
    where: { id: studentProfileId },
    data: { cgpa: totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0 },
  });

  revalidatePath("/dashboard/performance");
  return { success: true as const, grade, totalMarks };
}
