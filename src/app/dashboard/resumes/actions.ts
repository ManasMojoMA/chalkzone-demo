"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionStudentProfile, isStaff, requireUser } from "@/lib/session";
import type { Prisma } from "@prisma/client";
import { personalDetailsSchema } from "@/lib/validations";

export async function getResumes() {
  try {
    const profile = await getSessionStudentProfile();
    if (!profile) return [];

    const resumes = await prisma.resume.findMany({
      where: { studentProfileId: profile.id },
      orderBy: { updatedAt: "desc" },
    });

    return resumes;
  } catch (error) {
    console.error("Error fetching resumes:", error);
    return [];
  }
}

/** Returns the resume only if the session user owns it (or is staff). */
export async function getResume(id: string) {
  try {
    const user = await requireUser();
    const resume = await prisma.resume.findUnique({ where: { id } });
    if (!resume) return null;

    const owner = await prisma.studentProfile.findUnique({
      where: { id: resume.studentProfileId },
      select: { userId: true },
    });
    if (owner?.userId !== user.id && !isStaff(user)) return null;

    return resume;
  } catch (error) {
    console.error("Error fetching resume:", error);
    return null;
  }
}

export async function createResume(title: string) {
  const profile = await getSessionStudentProfile();
  if (!profile) {
    throw new Error("Student profile not found");
  }

  const defaultData = {
    personalDetails: { name: "", email: "", phone: "", address: "" },
    education: [],
    experience: [],
    skills: [],
  };

  const newResume = await prisma.resume.create({
    data: {
      studentProfileId: profile.id,
      title,
      dataJson: defaultData,
    },
  });

  revalidatePath("/dashboard/resumes");
  return newResume;
}

async function requireResumeOwnership(id: string) {
  const user = await requireUser();
  const resume = await prisma.resume.findUnique({
    where: { id },
    include: { student: true },
  });
  if (!resume || resume.student.userId !== user.id) {
    throw new Error("Resume not found or you do not have access to it.");
  }
  return resume;
}

export async function updateResume(id: string, title: string, dataJson: Prisma.InputJsonValue) {
  try {
    await requireResumeOwnership(id);

    if (!title.trim()) {
      return { success: false as const, error: "Title cannot be empty." };
    }

    if (dataJson && typeof dataJson === "object" && !Array.isArray(dataJson) && "personalDetails" in dataJson) {
      const parsed = personalDetailsSchema.safeParse((dataJson as Record<string, unknown>).personalDetails);
      if (!parsed.success) {
        return { success: false as const, error: parsed.error.issues?.[0]?.message || "Invalid personal details." };
      }
    }

    await prisma.resume.update({
      where: { id },
      data: {
        title,
        dataJson,
      },
    });

    revalidatePath("/dashboard/resumes");
    revalidatePath(`/dashboard/resumes/${id}`);
    return { success: true as const };
  } catch (error) {
    console.error("Error updating resume:", error);
    return { success: false as const, error: "Failed to save resume. Please try again." };
  }
}

export async function deleteResume(id: string) {
  await requireResumeOwnership(id);

  await prisma.resume.delete({
    where: { id },
  });

  revalidatePath("/dashboard/resumes");
}
