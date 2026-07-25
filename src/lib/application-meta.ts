import type { ApplicationStatus } from "@prisma/client";

/**
 * Visual metadata for the job-application pipeline. Column/card colors encode
 * the stage: cool blues/indigos while in review, warm amber/violet through
 * interviews, greens for offers, red/orange/gray for terminal outcomes.
 */
export const APP_STATUS_META: Record<
  ApplicationStatus,
  { label: string; column: string; border: string; badge: string; dot: string; terminal: boolean }
> = {
  APPLIED: {
    label: "Applied",
    column: "bg-blue-50 border-blue-300 dark:bg-blue-950/40 dark:border-blue-800",
    border: "border-l-blue-500",
    badge: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    dot: "bg-blue-500",
    terminal: false,
  },
  SHORTLISTED: {
    label: "Shortlisted",
    column: "bg-indigo-50 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800",
    border: "border-l-indigo-500",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
    dot: "bg-indigo-500",
    terminal: false,
  },
  INTERVIEW_SCHEDULED: {
    label: "Interview Scheduled",
    column: "bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800",
    border: "border-l-amber-500",
    badge: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-amber-500",
    terminal: false,
  },
  INTERVIEWED: {
    label: "Interviewed",
    column: "bg-violet-50 border-violet-300 dark:bg-violet-950/40 dark:border-violet-800",
    border: "border-l-violet-500",
    badge: "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
    dot: "bg-violet-500",
    terminal: false,
  },
  OFFERED: {
    label: "Offered",
    column: "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800",
    border: "border-l-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-emerald-500",
    terminal: false,
  },
  OFFER_ACCEPTED: {
    label: "Offer Accepted",
    column: "bg-green-50 border-green-400 dark:bg-green-950/40 dark:border-green-800",
    border: "border-l-green-600",
    badge: "bg-green-100 text-green-800 border-green-400 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
    dot: "bg-green-600",
    terminal: true,
  },
  OFFER_DECLINED: {
    label: "Offer Declined",
    column: "bg-orange-50 border-orange-300 dark:bg-orange-950/40 dark:border-orange-800",
    border: "border-l-orange-500",
    badge: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
    dot: "bg-orange-500",
    terminal: true,
  },
  REJECTED: {
    label: "Rejected",
    column: "bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-800",
    border: "border-l-red-500",
    badge: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    dot: "bg-red-500",
    terminal: true,
  },
  WITHDRAWN: {
    label: "Withdrawn",
    column: "bg-slate-100 border-slate-300 dark:bg-slate-900/60 dark:border-slate-700",
    border: "border-l-slate-400",
    badge: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700",
    dot: "bg-slate-400",
    terminal: true,
  },
};

export const APP_STATUS_ORDER: ApplicationStatus[] = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEWED",
  "OFFERED",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "REJECTED",
  "WITHDRAWN",
];
