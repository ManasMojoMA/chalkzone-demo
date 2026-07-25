/**
 * Dumps the local dev database to backups/erp_dev_<timestamp>.sql
 * Run with: npm run db:backup
 * Requires the Docker Postgres container (erp-postgres) to be running.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONTAINER = "erp-postgres";
const DB = "erp_dev";
const USER = "postgres";

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const outDir = join(process.cwd(), "backups");
const outFile = join(outDir, `${DB}_${stamp}.sql`);

mkdirSync(outDir, { recursive: true });

console.log(`Dumping ${DB} from container ${CONTAINER}...`);
const dump = execFileSync(
  "docker",
  ["exec", CONTAINER, "pg_dump", "-U", USER, "--clean", "--if-exists", DB],
  { maxBuffer: 1024 * 1024 * 512 }
);

writeFileSync(outFile, dump);
console.log(`Backup written to ${outFile} (${(dump.length / 1024).toFixed(1)} KB)`);
