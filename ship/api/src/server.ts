import "dotenv/config";
import http from "http";
import { createApp } from "./app.js";
import pool from "./db/pool.js";
import { setupWebSocket } from "./ws.js";
import { startSessionCleanup } from "./utils/sessionCleanup.js";

const PORT = process.env.PORT || 3000;

// Prevent unhandled rejections from crashing the process
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (non-fatal):", err);
});

async function start() {
  const app = createApp(pool);
  const server = http.createServer(app);

  // Start listening FIRST so healthcheck passes
  // Bind to 0.0.0.0 explicitly (required for Railway containers)
  server.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Ship API server listening on 0.0.0.0:${PORT}`);
  });

  setupWebSocket(server);

  // Run migrations AFTER server is listening
  try {
    const { runMigrations } = await import("./db/migrate.js");
    await runMigrations(pool);
    console.log("Migrations complete");
  } catch (err) {
    console.error("Migration error (non-fatal):", err);
  }

  // Delay session cleanup to ensure migrations have created the sessions table
  setTimeout(() => startSessionCleanup(pool, 60), 10000);
}

start();
