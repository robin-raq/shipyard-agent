import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://ship:ship@localhost:5433/ship_dev";

const isProduction = process.env.NODE_ENV === "production";

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  max: 10,
});

// Log connection errors instead of crashing
pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err.message);
});

export default pool;
