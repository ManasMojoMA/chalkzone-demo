"use server";

import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type DashboardStat = {
  label: string;
  value: string;
  hint: string;
};

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_STUDENT"] as const;

export async function getDashboardStats(): Promise<DashboardStat[]> {
  const user = await requireUser();

  if (user.role === "STUDENT") {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      include: { attendances: true },
    });

    const attendances = profile?.attendances ?? [];
    const avgAttendance =
      attendances.length > 0
        ? attendances.reduce((acc, a) => acc + a.percentage, 0) / attendances.length
        : 0;

    const [openTickets, activeJobs, myApplications] = await Promise.all([
      prisma.ticket.count({
        where: { creatorId: user.id, status: { in: [...OPEN_STATUSES] } },
      }),
      prisma.jobPosting.count({ where: { isActive: true } }),
      profile
        ? prisma.jobApplication.count({ where: { studentProfileId: profile.id } })
        : Promise.resolve(0),
    ]);

    return [
      {
        label: "Attendance",
        value: attendances.length > 0 ? `${Math.round(avgAttendance)}%` : "—",
        hint: attendances.length > 0 ? `Across ${attendances.length} subjects` : "No records yet",
      },
      {
        label: "Current CGPA",
        value: profile?.cgpa ? profile.cgpa.toFixed(2) : "—",
        hint: profile?.cgpa ? "Credit-weighted average" : "No marks recorded yet",
      },
      {
        label: "Active Tickets",
        value: String(openTickets),
        hint: openTickets > 0 ? "Awaiting resolution" : "All resolved",
      },
      {
        label: "Open Job Postings",
        value: String(activeJobs),
        hint: `You have applied to ${myApplications}`,
      },
    ];
  }

  // Staff / other roles: platform-wide numbers
  const [totalUsers, openTickets, activeJobs, pendingAppraisals] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.ticket.count({ where: { status: { in: [...OPEN_STATUSES] } } }),
    prisma.jobPosting.count({ where: { isActive: true } }),
    prisma.facultySubmission.count({
      where: { status: "SUBMITTED", evaluation: null },
    }),
  ]);

  return [
    {
      label: "Total Users",
      value: String(totalUsers),
      hint: "Active accounts on the platform",
    },
    {
      label: "Open Tickets",
      value: String(openTickets),
      hint: openTickets > 0 ? "Needs attention" : "Queue is clear",
    },
    {
      label: "Active Job Postings",
      value: String(activeJobs),
      hint: "Currently accepting applications",
    },
    {
      label: "Pending Appraisals",
      value: String(pendingAppraisals),
      hint: pendingAppraisals > 0 ? "Awaiting evaluation" : "All evaluated",
    },
  ];
}
