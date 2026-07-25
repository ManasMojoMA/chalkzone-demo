import type { TicketPriority, TicketStatus } from "@prisma/client";

/**
 * Shared visual metadata for the ticket system. Column/card colors encode the
 * workflow stage so status is legible at a glance; escalation renders as a
 * red overlay badge on top of whatever stage the ticket is in.
 */

export const STATUS_META: Record<
  TicketStatus,
  { label: string; column: string; border: string; badge: string; dot: string }
> = {
  OPEN: {
    label: "Open",
    column: "bg-blue-50 border-blue-300 dark:bg-blue-950/40 dark:border-blue-800",
    border: "border-l-blue-500",
    badge: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  IN_PROGRESS: {
    label: "In Progress",
    column: "bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800",
    border: "border-l-amber-500",
    badge: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  WAITING_FOR_STUDENT: {
    label: "Waiting for Student",
    column: "bg-violet-50 border-violet-300 dark:bg-violet-950/40 dark:border-violet-800",
    border: "border-l-violet-500",
    badge: "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
    dot: "bg-violet-500",
  },
  RESOLVED: {
    label: "Resolved",
    column: "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800",
    border: "border-l-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  CLOSED: {
    label: "Closed",
    column: "bg-slate-100 border-slate-300 dark:bg-slate-900/60 dark:border-slate-700",
    border: "border-l-slate-400",
    badge: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700",
    dot: "bg-slate-400",
  },
};

export const STATUS_ORDER: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_STUDENT",
  "RESOLVED",
  "CLOSED",
];

export const PRIORITY_META: Record<
  TicketPriority,
  { label: string; badge: string; rank: number }
> = {
  LOW: { label: "Low", badge: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700", rank: 0 },
  MEDIUM: { label: "Medium", badge: "bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800", rank: 1 },
  HIGH: { label: "High", badge: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800", rank: 2 },
  CRITICAL: { label: "Critical", badge: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800", rank: 3 },
};

const OPEN_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_FOR_STUDENT"];

/** A ticket is escalated when it's still unresolved past its SLA deadline. */
export function isTicketEscalated(t: { status: TicketStatus; slaDeadline: Date | string | null }): boolean {
  if (!t.slaDeadline) return false;
  if (!OPEN_STATUSES.includes(t.status)) return false;
  return new Date(t.slaDeadline).getTime() < Date.now();
}

/** Human-readable time remaining until (or since) the SLA deadline. */
export function slaCountdown(deadline: Date | string | null): string | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3_600_000);
  const days = Math.floor(hours / 24);
  const label = days >= 1 ? `${days}d ${hours % 24}h` : `${hours}h ${Math.floor((abs % 3_600_000) / 60_000)}m`;
  return ms >= 0 ? `${label} left` : `overdue by ${label}`;
}
