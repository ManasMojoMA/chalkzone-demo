/**
 * Create one demo account per role, for the public demo's role buttons.
 *
 * Idempotent: re-running updates the password and role rather than duplicating.
 * Only ever run this against the DEMO Supabase project — it writes auth users.
 *
 *   node scripts/seed-demo-users.mjs
 *
 * Passwords are read from .env (DEMO_PASSWORD_<ROLE>) so they are never hardcoded
 * here, and the same values go into the deployment's env vars.
 */

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

// Every role in the Prisma enum. The whole point of this app is that the dashboard
// changes per role, so a demo that only exposes one role shows almost nothing.
const ROLES = [
  { role: 'STUDENT', name: 'Demo Student' },
  { role: 'FACULTY', name: 'Demo Faculty' },
  { role: 'HR', name: 'Demo HR' },
  { role: 'MANAGER', name: 'Demo Manager' },
  { role: 'ADMIN', name: 'Demo Admin' },
  { role: 'SUPER_ADMIN', name: 'Demo Super Admin' },
  { role: 'PARENT', name: 'Demo Parent' },
  { role: 'EXECUTIVE', name: 'Demo Executive' },
];

const emailFor = (role) => `demo.${role.toLowerCase().replace(/_/g, '')}@chalkzone.demo`;
const passwordFor = (role) => env[`DEMO_PASSWORD_${role}`];

const api = (path, init = {}) =>
  fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

// Prisma 7 ships no bundled engine — a driver adapter is required, matching
// src/lib/prisma.ts.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL, max: 5 }),
});

async function findAuthUser(email) {
  const res = await api(`/auth/v1/admin/users?per_page=200`);
  const { users = [] } = await res.json();
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function main() {
  const missing = ROLES.filter((r) => !passwordFor(r.role));
  if (missing.length) {
    console.error('✗ Missing passwords in .env for: ' + missing.map((m) => m.role).join(', '));
    console.error('  Expected keys like DEMO_PASSWORD_STUDENT=...');
    process.exit(1);
  }

  for (const { role, name } of ROLES) {
    const email = emailFor(role);
    const password = passwordFor(role);

    let authUser = await findAuthUser(email);

    if (authUser) {
      // Keep the password in sync with whatever the deployment is configured with.
      await api(`/auth/v1/admin/users/${authUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ password, email_confirm: true }),
      });
    } else {
      const res = await api('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      authUser = await res.json();
      if (!authUser.id) {
        console.error(`  ✗ ${role}: ${authUser.msg || JSON.stringify(authUser)}`);
        continue;
      }
    }

    // The app resolves a role by joining supabaseUid → User.role, so the auth user
    // alone is not enough; without this row the visitor logs in and sees nothing.
    await prisma.user.upsert({
      where: { email },
      create: { email, name, role, supabaseUid: authUser.id, isActive: true },
      update: { role, supabaseUid: authUser.id, isActive: true, name },
    });

    console.log(`  ✓ ${role.padEnd(12)} ${email}`);
  }
}

main()
  .catch((err) => {
    console.error('✗', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
