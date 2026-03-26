import "dotenv/config";
import http from "http";
import { createApp } from "./app.js";
import pool from "./db/pool.js";
import { setupWebSocket } from "./ws.js";
import { startSessionCleanup } from "./utils/sessionCleanup.js";

const PORT = process.env.PORT || 3000;

async function start() {
  // Run migrations on startup in production
  try {
    const { runMigrations } = await import("./db/migrate.js");
    await runMigrations(pool);
    console.log("Migrations complete");
  } catch (err) {
    console.error("Migration error (non-fatal):", err);
  }

  const app = createApp(pool);
  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`Ship API server listening on port ${PORT}`);
  });

  setupWebSocket(server);
  startSessionCleanup(pool, 60);
}

start();
