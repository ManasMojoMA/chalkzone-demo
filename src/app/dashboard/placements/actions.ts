"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionStudentProfile, requireRole, requireUser } from "@/lib/session";
import { logInternshipSchema, createJobPostingSchema } from "@/lib/validations";
import { notify } from "@/lib/notify";
import { APP_STATUS_META } from "@/lib/application-meta";

export async function seedPlacementsData() {
  await requireUser();
  const company1 = await prisma.company.upsert({
    where: { name: "Google" },
    update: {},
    create: {
      name: "Google",
      description: "Tech giant",
      website: "https://google.com",
    },
  });

  const company2 = await prisma.company.upsert({
    where: { name: "Microsoft" },
    update: {},
    create: {
      name: "Microsoft",
      description: "Empowering every person",
      website: "https://microsoft.com",
    },
  });

  // Only seed postings once — repeated clicks shouldn't create duplicates
  const existingPostings = await prisma.jobPosting.count();
  if (existingPostings === 0) {
    await prisma.jobPosting.create({
      data: {
        companyId: company1.id,
        title: "Software Engineer",
        description: "Join the search team.",
        isActive: true,
        deadline: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      },
    });

    await prisma.jobPosting.create({
      data: {
        companyId: company2.id,
        title: "Program Manager",
        description: "Lead Office 365 initiatives.",
        isActive: true,
        deadline: new Date(new Date().setMonth(new Date().getMonth() + 2)),
      },
    });
  }

  revalidatePath("/dashboard/placements");
  return { success: true };
}

export async function getJobPostings() {
  await requireUser();
  return prisma.jobPosting.findMany({
    include: {
      company: true,
      applications: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function applyForJob(jobPostingId: string) {
  try {
    const profile = await getSessionStudentProfile();
    if (!profile) {
      return { success: false, error: "No student profile found for your account." };
    }

    const posting = await prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
    if (!posting || !posting.isActive) {
      return { success: false, error: "This job posting is no longer active." };
    }
    if (posting.deadline && posting.deadline < new Date()) {
      return { success: false, error: "The application deadline has passed." };
    }

    // Attach the student's most recently updated resume so HR sees it
    const latestResume = await prisma.resume.findFirst({
      where: { studentProfileId: profile.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    await prisma.jobApplication.create({
      data: {
        jobPostingId,
        studentProfileId: profile.id,
        status: "APPLIED",
        resumeId: latestResume?.id ?? null,
      },
    });
    revalidatePath("/dashboard/placements");
    return { success: true };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { success: false, error: "You have already applied to this job." };
    }
    console.error("Error applying for job:", e);
    return { success: false, error: "Failed to apply. Please try again." };
  }
}

export async function getInternships() {
  const profile = await getSessionStudentProfile();
  if (!profile) return [];
  return prisma.internship.findMany({
    where: { studentProfileId: profile.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllApplications() {
  await requireRole("HR", "MANAGER", "ADMIN", "SUPER_ADMIN", "EXECUTIVE");
  return prisma.jobApplication.findMany({
    include: { student: { include: { user: true } }, jobPosting: { include: { company: true } } },
    orderBy: { appliedAt: "desc" }
  });
}

/** The signed-in student's own applications. */
export async function getMyApplications() {
  const profile = await getSessionStudentProfile();
  if (!profile) return [];
  return prisma.jobApplication.findMany({
    where: { studentProfileId: profile.id },
    include: { jobPosting: { include: { company: true } } },
    orderBy: { appliedAt: "desc" },
  });
}

const APP_STATUSES = [
  "APPLIED", "SHORTLISTED", "INTERVIEW_SCHEDULED", "INTERVIEWED",
  "OFFERED", "OFFER_ACCEPTED", "OFFER_DECLINED", "REJECTED", "WITHDRAWN",
] as const;
type AppStatus = (typeof APP_STATUSES)[number];

/** HR/Admin move applications through the pipeline (kanban drag or list select). */
export async function updateApplicationStatus(applicationId: string, status: AppStatus) {
  await requireRole("HR", "MANAGER", "ADMIN", "SUPER_ADMIN");
  if (!APP_STATUSES.includes(status)) {
    return { success: false as const, error: "Invalid status" };
  }
  try {
    const app = await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status },
      include: { student: true, jobPosting: true },
    });

    await notify([app.student.userId], {
      type: "APPLICATION",
      title: `Application update: ${APP_STATUS_META[status].label}`,
      body: `Your application for "${app.jobPosting.title}" moved to ${APP_STATUS_META[status].label}.`,
      link: "/dashboard/placements",
    });

    revalidatePath("/dashboard/placements");
    return { success: true as const };
  } catch (e) {
    console.error("updateApplicationStatus failed:", e);
    return { success: false as const, error: "Failed to update application" };
  }
}

/** Students may pull out of their own non-terminal applications. */
export async function withdrawApplication(applicationId: string) {
  const profile = await getSessionStudentProfile();
  if (!profile) return { success: false as const, error: "No student profile" };

  const app = await prisma.jobApplication.findUnique({ where: { id: applicationId } });
  if (!app || app.studentProfileId !== profile.id) {
    return { success: false as const, error: "Application not found" };
  }
  if (["OFFER_ACCEPTED", "OFFER_DECLINED", "REJECTED", "WITHDRAWN"].includes(app.status)) {
    return { success: false as const, error: "This application is already closed" };
  }

  await prisma.jobApplication.update({ where: { id: applicationId }, data: { status: "WITHDRAWN" } });
  revalidatePath("/dashboard/placements");
  return { success: true as const };
}

export async function logInternship(data: unknown) {
  const parsed = logInternshipSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues?.[0]?.message || parsed.error.message };
  }
  const validData = parsed.data;

  const profile = await getSessionStudentProfile();
  if (!profile) {
    return { success: false, error: "No student profile found for your account." };
  }

  await prisma.internship.create({
    data: {
      studentProfileId: profile.id,
      companyName: validData.companyName,
      designation: validData.designation,
      startDate: validData.startDate,
      endDate: validData.endDate,
      status: "PENDING",
    },
  });
  revalidatePath("/dashboard/placements");
  return { success: true };
}

export async function createJobPosting(data: unknown) {
  await requireRole("HR", "MANAGER", "ADMIN", "SUPER_ADMIN");
  
  const parsed = createJobPostingSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues?.[0]?.message || parsed.error.message);
  }
  const validData = parsed.data;
  await prisma.jobPosting.create({
    data: {
      companyId: validData.companyId,
      title: validData.title,
      description: validData.description,
      deadline: validData.deadline,
    },
  });
  revalidatePath("/dashboard/placements");
}

export async function getCompanies() {
  await requireUser();
  return prisma.company.findMany();
}

export async function getMyStudentProfile() {
  return getSessionStudentProfile();
}
