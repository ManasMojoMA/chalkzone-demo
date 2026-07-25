/**
 * Cloud data snapshot: dumps every app table from the live Supabase database
 * to a timestamped JSON file in backups/. Complements (does not replace)
 * proper pg backups — upgrade Supabase for point-in-time recovery.
 * Run with: npm run db:cloud-backup
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public'
     AND tablename NOT IN ('_prisma_migrations') ORDER BY tablename`
  );

  const dump: Record<string, unknown[]> = {};
  for (const { tablename } of tables) {
    try {
      dump[tablename] = await prisma.$queryRawUnsafe(
        `SELECT to_jsonb(t) AS row FROM "${tablename}" t`
      ).then((rows) => (rows as { row: unknown }[]).map((r) => r.row));
    } catch (e) {
      console.warn(`skipped ${tablename}:`, e instanceof Error ? e.message.slice(0, 80) : e);
    }
  }

  mkdirSync("backups", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const file = join("backups", `cloud_${stamp}.json`);
  writeFileSync(file, JSON.stringify(dump, null, 1));
  const counts = Object.entries(dump).map(([t, r]) => `${t}:${r.length}`).join(" ");
  console.log("Snapshot written:", file);
  console.log(counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
