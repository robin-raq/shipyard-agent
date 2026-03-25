import pg from "pg";
import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(pool?: pg.Pool): Promise<void> {
  // Use provided pool or lazy import default pool
  let dbPool: pg.Pool;
  if (pool) {
    dbPool = pool;
  } else {
    const poolModule = await import("./pool.js");
    dbPool = poolModule.default;
  }

  const migrationsDir = join(__dirname, "migrations");
  
  try {
    const files = await readdir(migrationsDir);
    const sqlFiles = files
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of sqlFiles) {
      const filePath = join(migrationsDir, file);
      const sql = await readFile(filePath, "utf-8");
      
      console.log(`Running migration: ${file}`);
      await dbPool.query(sql);
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
