/**
 * Restores the local dev database from a backup file.
 * Usage:
 *   npm run db:restore                      -> restores the newest backup
 *   npm run db:restore -- backups/file.sql  -> restores a specific file
 * WARNING: this REPLACES the current contents of the erp_dev database.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CONTAINER = "erp-postgres";
const DB = "erp_dev";
const USER = "postgres";

let file = process.argv[2];
if (!file) {
  const dir = join(process.cwd(), "backups");
  const candidates = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    : [];
  if (candidates.length === 0) {
    console.error("No .sql backups found in backups/. Run npm run db:backup first.");
    process.exit(1);
  }
  file = join(dir, candidates[candidates.length - 1]);
}

if (!existsSync(file)) {
  console.error(`Backup file not found: ${file}`);
  process.exit(1);
}

console.log(`Restoring ${DB} from ${file}...`);
const sql = readFileSync(file);
execFileSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", USER, "-d", DB], {
  input: sql,
  stdio: ["pipe", "ignore", "inherit"],
});
console.log("Restore complete.");
