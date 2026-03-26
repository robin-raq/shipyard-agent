import "dotenv/config";
import http from "http";
import { createApp } from "./app.js";
import pool from "./db/pool.js";
import { setupWebSocket } from "./ws.js";

const PORT = process.env.PORT || 3000;

const app = createApp(pool);
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Ship API server listening on port ${PORT}`);
});

setupWebSocket(server);
