import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getPool } from "./db.mjs";

const sqlDir = join(process.cwd(), "api", "sql");
const pool = getPool();

await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const files = (await readdir(sqlDir)).filter((file) => file.endsWith(".sql")).sort();

for (const file of files) {
  const applied = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
  if (applied.rowCount) {
    console.log(`skip ${file}`);
    continue;
  }

  const sql = await readFile(join(sqlDir, file), "utf8");
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    await pool.query("COMMIT");
    console.log(`applied ${file}`);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

await pool.end();
