import express, { Express } from "express";
import cors from "cors";
import pg from "pg";
import { createDocumentsRouter } from "./routes/documents.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp(pool: pg.Pool): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Routes
  app.use("/api/documents", createDocumentsRouter(pool));

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
