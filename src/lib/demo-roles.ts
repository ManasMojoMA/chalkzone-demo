/**
 * Demo role accounts for the public demo's one-click login buttons.
 *
 * Why buttons rather than credentials published on the portfolio: one click with
 * nothing to type, nothing to rotate anywhere but here, and a visitor sees every
 * role the app has. That matters most in this app — the dashboard is almost
 * entirely different per role, so a demo exposing one account shows very little.
 *
 * Honest limit: these passwords are compiled into the client bundle
 * (NEXT_PUBLIC_*) and readable in DevTools. That is acceptable ONLY because each
 * account is fake, holds invented data, exists in a demo-only Supabase project, and
 * is privileged no further than that project.
 *
 * Accounts are created by scripts/seed-demo-users.mjs, which also writes the
 * matching `users` row — the app resolves a role by joining supabaseUid to
 * User.role, so an auth user with no row logs in and sees nothing.
 */

export interface DemoRole {
  key: string;
  label: string;
  blurb: string;
  email: string;
  password: string;
  /** Grouping for the UI — 8 flat buttons is a wall. */
  group: 'Learning' | 'Operations' | 'Leadership';
}

const DEFS: Array<Omit<DemoRole, 'email' | 'password'>> = [
  { key: 'STUDENT', label: 'Student', blurb: 'Attendance, results, resume builder', group: 'Learning' },
  { key: 'PARENT', label: 'Parent', blurb: 'Track a student’s attendance and results', group: 'Learning' },
  { key: 'FACULTY', label: 'Faculty', blurb: 'Mark attendance, enter marks, raise tickets', group: 'Learning' },

  { key: 'HR', label: 'HR', blurb: 'Appraisals, staff records, approvals', group: 'Operations' },
  { key: 'MANAGER', label: 'Manager', blurb: 'Team performance and ticket queues', group: 'Operations' },
  { key: 'ADMIN', label: 'Admin', blurb: 'Full operational control across modules', group: 'Operations' },

  { key: 'EXECUTIVE', label: 'Executive', blurb: 'Cross-department analytics and reports', group: 'Leadership' },
  { key: 'SUPER_ADMIN', label: 'Super Admin', blurb: 'Everything, including configuration', group: 'Leadership' },
];

/** Matches the email scheme in scripts/seed-demo-users.mjs. */
const emailFor = (key: string) => `demo.${key.toLowerCase().replace(/_/g, '')}@chalkzone.demo`;

// Next.js inlines process.env.NEXT_PUBLIC_* only for statically analysable member
// expressions, so these cannot be built from a variable — each must be written out.
const PASSWORDS: Record<string, string | undefined> = {
  STUDENT: process.env.NEXT_PUBLIC_DEMO_PASSWORD_STUDENT,
  PARENT: process.env.NEXT_PUBLIC_DEMO_PASSWORD_PARENT,
  FACULTY: process.env.NEXT_PUBLIC_DEMO_PASSWORD_FACULTY,
  HR: process.env.NEXT_PUBLIC_DEMO_PASSWORD_HR,
  MANAGER: process.env.NEXT_PUBLIC_DEMO_PASSWORD_MANAGER,
  ADMIN: process.env.NEXT_PUBLIC_DEMO_PASSWORD_ADMIN,
  EXECUTIVE: process.env.NEXT_PUBLIC_DEMO_PASSWORD_EXECUTIVE,
  SUPER_ADMIN: process.env.NEXT_PUBLIC_DEMO_PASSWORD_SUPER_ADMIN,
};

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/** Only roles whose password is actually configured — a button that cannot work is worse than no button. */
export const DEMO_ROLES: DemoRole[] = DEFS.filter((d) => PASSWORDS[d.key]).map((d) => ({
  ...d,
  email: emailFor(d.key),
  password: PASSWORDS[d.key]!,
}));

export const DEMO_GROUPS = ['Learning', 'Operations', 'Leadership'] as const;
