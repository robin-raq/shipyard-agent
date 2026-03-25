import "dotenv/config";
import { createApp } from "./app.js";
import pool from "./db/pool.js";

const PORT = process.env.PORT || 3000;

const app = createApp(pool);

app.listen(PORT, () => {
  console.log(`Ship API server listening on port ${PORT}`);
});
