/**
 * Shared constant — kept OUT of actions.ts because a "use server" file may
 * only export async functions; exporting this array there threw
 * "A 'use server' file can only export async functions, found object."
 */
export const ANNOUNCEMENT_CATEGORIES = ["ACADEMICS", "PLACEMENTS", "EVENTS", "ALERTS"] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];
