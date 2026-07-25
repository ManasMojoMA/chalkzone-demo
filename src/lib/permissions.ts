/**
 * Configurable per-role access control.
 *
 * Each app section has a stable key. A RolePermission row (role, section,
 * level) overrides the default; absence of a row means the role's built-in
 * behaviour stands (EDIT — today's behaviour). Levels:
 *   NONE — section hidden from the menu and blocked if visited directly
 *   VIEW — section visible read-only; mutating actions are rejected
 *   EDIT — full access
 * SUPER_ADMIN always has EDIT everywhere and cannot be restricted.
 */

export type PermissionLevel = "NONE" | "VIEW" | "EDIT";

export const APP_SECTIONS = [
  { key: "attendance", label: "Attendance", urls: ["/dashboard/attendance"] },
  { key: "performance", label: "Performance", urls: ["/dashboard/performance"] },
  { key: "resumes", label: "Resumes", urls: ["/dashboard/resumes"] },
  { key: "placements", label: "Placements & Jobs", urls: ["/dashboard/placements"] },
  { key: "appraisals", label: "Appraisals", urls: ["/dashboard/appraisals"] },
  { key: "tickets", label: "Tickets", urls: ["/dashboard/tickets"] },
  { key: "knowledge-base", label: "Knowledge Base", urls: ["/dashboard/knowledge-base"] },
  { key: "timetable", label: "Timetable", urls: ["/dashboard/timetable"] },
  { key: "announcements", label: "Announcements", urls: ["/dashboard/announcements"] },
  { key: "users", label: "User Management", urls: ["/dashboard/admin/users"] },
  { key: "programs", label: "Program Management", urls: ["/dashboard/programs"] },
  { key: "configuration", label: "Configuration", urls: ["/dashboard/admin/config"] },
] as const;

export type SectionKey = (typeof APP_SECTIONS)[number]["key"];

/** Roles the matrix manages (SUPER_ADMIN is exempt by design). */
export const MANAGED_ROLES = ["STUDENT", "FACULTY", "HR", "MANAGER", "ADMIN", "PARENT", "EXECUTIVE"] as const;

/** Map a pathname to its section key (longest-prefix match). */
export function sectionForPath(pathname: string): SectionKey | null {
  for (const s of APP_SECTIONS) {
    if (s.urls.some((u) => pathname === u || pathname.startsWith(u + "/"))) return s.key;
  }
  return null;
}
