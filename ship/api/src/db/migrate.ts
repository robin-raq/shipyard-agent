import "dotenv/config";
import pg from "pg";
import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(pool?: pg.Pool): Promise<void> {
  let dbPool: pg.Pool;
  if (pool) {
    dbPool = pool;
  } else {
    const poolModule = await import("./pool.js");
    dbPool = poolModule.default;
  }

  const migrationsDir = join(__dirname, "migrations");

  try {
    // Create migrations tracking table if it doesn't exist
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        run_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get already-run migrations
    const { rows: completed } = await dbPool.query(
      "SELECT name FROM _migrations ORDER BY name"
    );
    const completedSet = new Set(completed.map((r: { name: string }) => r.name));

    const files = await readdir(migrationsDir);
    const sqlFiles = files
      .filter((file) => file.endsWith(".sql") && !file.includes(".skip") && !file.includes(".bak"))
      .sort();

    for (const file of sqlFiles) {
      if (completedSet.has(file)) {
        continue; // Already run, skip
      }

      const filePath = join(migrationsDir, file);
      const sql = await readFile(filePath, "utf-8");

      console.log(`Running migration: ${file}`);
      await dbPool.query(sql);
      await dbPool.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      console.log(`✓ Completed migration: ${file}`);
    }

    console.log("All migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// If run directly, execute migrations
if (import.meta.url === `file://${process.argv[1]}`) {
  const poolModule = await import("./pool.js");
  const pool = poolModule.default;

  try {
    await runMigrations(pool);
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Migration script failed:", error);
    await pool.end();
    process.exit(1);
  }
}
