import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://ship:ship@localhost:5433/ship_dev";

const isProduction = process.env.NODE_ENV === "production";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

export default getPool();
