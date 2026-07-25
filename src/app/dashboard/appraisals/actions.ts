"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionFacultyProfile, requireRole, requireUser } from "@/lib/session";
import type { Prisma } from "@prisma/client";
import { appraisalSubmissionSchema, evaluationSchema } from "@/lib/validations";
import { notify } from "@/lib/notify";

export async function getActiveAppraisalCycle() {
  await requireUser();
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "OPEN" },
    orderBy: { startDate: "desc" },
  });
  return cycle;
}

export async function createMockAppraisalCycle() {
  await requireRole("MANAGER", "HR", "ADMIN", "SUPER_ADMIN");
  const cycle = await prisma.appraisalCycle.create({
    data: {
      name: "Annual Faculty Appraisal 2026",
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      status: "OPEN",
    },
  });
  revalidatePath("/dashboard/appraisals");
  return cycle;
}

export async function getFacultyProfile() {
  return getSessionFacultyProfile();
}

export async function getFacultySubmission(cycleId: string) {
  const profile = await getSessionFacultyProfile();
  if (!profile) return null;

  return await prisma.facultySubmission.findUnique({
    where: {
      cycleId_facultyProfileId: {
        cycleId,
        facultyProfileId: profile.id,
      },
    },
    include: {
      evaluation: true,
    },
  });
}

export async function getAllSubmissions(cycleId: string) {
  await requireRole("MANAGER", "HR", "ADMIN", "SUPER_ADMIN");
  return await prisma.facultySubmission.findMany({
    where: { cycleId },
    include: {
      faculty: {
        include: {
          user: true,
        },
      },
      evaluation: true,
    },
  });
}

export async function submitAppraisal(cycleId: string, dataJson: unknown) {
  const parsed = appraisalSubmissionSchema.safeParse(dataJson);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Validation failed");
  }

  const profile = await getSessionFacultyProfile();
  if (!profile) {
    throw new Error("No faculty profile found for your account.");
  }

  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.status !== "OPEN") {
    throw new Error("This appraisal cycle is not open for submissions.");
  }

  const submission = await prisma.facultySubmission.upsert({
    where: {
      cycleId_facultyProfileId: {
        cycleId,
        facultyProfileId: profile.id,
      },
    },
    update: {
      dataJson: parsed.data as any,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
    create: {
      id: crypto.randomUUID(),
      cycleId,
      facultyProfileId: profile.id,
      dataJson: parsed.data as any,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/appraisals");
  return submission;
}

export async function evaluateSubmission(
  submissionId: string,
  finalScore: number,
  evaluatorNotes: string
) {
  await requireRole("MANAGER", "HR", "ADMIN", "SUPER_ADMIN");

  const parsed = evaluationSchema.safeParse({ finalScore, evaluatorNotes });
  if (!parsed.success) {
    throw new Error(parsed.error.issues?.[0]?.message || parsed.error.message);
  }

  // Derive cycle and faculty from the submission itself — never trust the client
  const submission = await prisma.facultySubmission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) {
    throw new Error("Submission not found.");
  }

  const evaluation = await prisma.facultyEvaluation.upsert({
    where: {
      submissionId,
    },
    update: {
      finalScore,
      evaluatorNotes,
    },
    create: {
      cycleId: submission.cycleId,
      submissionId,
      facultyProfileId: submission.facultyProfileId,
      finalScore,
      evaluatorNotes,
    },
  });

  const faculty = await prisma.facultyProfile.findUnique({
    where: { id: submission.facultyProfileId },
    select: { userId: true },
  });
  if (faculty) {
    await notify([faculty.userId], {
      type: "APPRAISAL",
      title: "Your appraisal has been evaluated",
      body: `Final score: ${finalScore}/10. Open Appraisals to see the evaluator's notes.`,
      link: "/dashboard/appraisals",
    });
  }

  revalidatePath("/dashboard/appraisals");
  return evaluation;
}
