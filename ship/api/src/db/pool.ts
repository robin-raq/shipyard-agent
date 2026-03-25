import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://ship:ship@localhost:5433/ship_dev";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

export default getPool();
