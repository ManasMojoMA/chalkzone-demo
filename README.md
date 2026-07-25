# University ERP / LMS (ChalkZone)

A unified university management platform built with **Next.js 16, React 19, Prisma 7, Supabase (Auth + Postgres/pgvector), and Gemini AI**.

Modules: Attendance · Performance/Marks · Support Tickets (list + kanban) · Placements & Internships · Resume Builder · Faculty Appraisals · AI Knowledge Base · AI Assistant (Gemini + RAG) · User Management

## Getting started

Prerequisites: Node.js 20+, a Supabase project (free tier works).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
#    Copy the template and fill in Supabase + Gemini values
cp .env.example .env

# 3. Create the schema and seed demo data (uses DIRECT_URL / session pooler)
#    Always use db:push (not raw `prisma db push`) — it re-creates the pgvector
#    HNSW index, which `prisma db push` silently drops.
npm run db:push
npm run db:seed

# 4. Create the demo login accounts in Supabase Auth and link them
npx tsx scripts/create-supabase-users.ts

# 5. (Optional, needs GEMINI_API_KEY) index knowledge-base docs for RAG
npm run db:embed

# 6. Run the app
npm run dev
```

## Demo accounts

`scripts/create-supabase-users.ts` provisions one account per role, all with password **`Password123!`**:

| Role | Email |
| --- | --- |
| Student | `student@university.edu` |
| Faculty | `faculty@university.edu` |
| HR | `hr@company.com` |
| Manager | `manager@university.edu` |
| Admin | `admin@university.edu` |
| Super Admin | `superadmin@university.edu` |
| Parent | `parent@university.edu` |
| Executive | `executive@university.edu` |

> Change these passwords (or delete the demo accounts) before any real rollout.

## Database connections (important)

Supabase's direct connection (`db.<ref>.supabase.co`) is **IPv6-only** and unreachable from most networks and from Vercel. Always use the Supavisor pooler:

- **App runtime** (`DATABASE_URL`): transaction pooler, port **6543**
- **Migrations/seed** (`DIRECT_URL`): session pooler, port **5432**

## Environment variables

See [.env.example](.env.example). The real `.env` is **gitignored — never commit it**; it contains your `GEMINI_API_KEY` and database credentials. When setting up a new machine, copy `.env.example` to `.env` and fill it in.

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run lint` | ESLint |
| `npm run db:seed` | Idempotent demo data (users, subjects, marks, tickets, jobs, policies) |
| `npm run db:embed` | Backfill pgvector embeddings for knowledge-base documents |
| `npm run db:backup` | Dump the dev database to `backups/erp_dev_<timestamp>.sql` |
| `npm run db:restore` | Restore the newest backup (or `-- backups/<file>.sql` for a specific one) |

## Staying safe: versioning, rollback & backups

**Code** — every meaningful change lives in its own commit on this repo, so you can always roll back:

- See history: `git log --oneline`
- Undo a specific bad change *safely* (creates a new commit, nothing is lost): `git revert <commit>`
- Inspect an old version without changing anything: `git checkout <commit> -- <file>` or browse on GitHub
- Stable milestones are tagged (`git tag`); to return the whole project to a tag: create a branch from it (`git switch -c hotfix v0.1.0`) rather than resetting `main`.
- Prefer `git revert` over `git reset --hard` on anything already pushed — revert preserves history, reset rewrites it.

**New work** — do it on a feature branch, not directly on `main`:

```bash
git switch -c feature/my-change   # work, commit
git switch main && git merge feature/my-change
```

`main` should always be in a working state. On GitHub, consider enabling **branch protection** for `main` (Settings → Branches) so nothing can be force-pushed or deleted.

**Database** — git does *not* back up your data. Supabase (paid tiers) takes automatic daily backups; on the free tier, export manually from the dashboard or via `pg_dump` against the session pooler. The local `npm run db:backup`/`db:restore` scripts target the optional Docker dev database.

**Secrets** — if a real API key is ever committed by accident, treat it as leaked: revoke it in Google AI Studio, generate a new one, and rewrite history before pushing.

## Architecture notes

- **Auth:** Supabase Auth (email/password). Middleware ([src/middleware.ts](src/middleware.ts)) refreshes sessions and gates `/dashboard`; every server action re-validates via [src/lib/session.ts](src/lib/session.ts) (`supabase.auth.getUser()` → Prisma user by `supabaseUid`) — no client-supplied IDs are trusted, and role checks happen server-side.
- **AI/RAG:** [src/lib/ai.ts](src/lib/ai.ts) calls Gemini (`gemini-flash-latest` chat, `gemini-embedding-001` @ 768 dims). Knowledge-base documents are embedded on upload and retrieved via pgvector cosine search. No API key → graceful mock mode.
- **Prisma 7:** requires the `@prisma/adapter-pg` driver adapter (no bundled engine). The client singleton with pool limits lives in [src/lib/prisma.ts](src/lib/prisma.ts).
- **Validation:** shared zod schemas in [src/lib/validations.ts](src/lib/validations.ts) are enforced inside server actions.
