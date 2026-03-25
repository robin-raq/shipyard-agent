import express, { Express } from "express";
import cors from "cors";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { createDocumentsRouter } from "./routes/documents.js";
import { createDocsRouter } from "./routes/docs.js";
import { createIssuesRouter } from "./routes/issues.js";
import { createProjectsRouter } from "./routes/projects.js";
import { createWeeksRouter } from "./routes/weeks.js";
import { createTeamsRouter } from "./routes/teams.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(pool: pg.Pool): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API Routes
  app.use("/api/documents", createDocumentsRouter(pool)); // backward compatibility
  app.use("/api/docs", createDocsRouter(pool));
  app.use("/api/issues", createIssuesRouter(pool));
  app.use("/api/projects", createProjectsRouter(pool));
  app.use("/api/weeks", createWeeksRouter(pool));
  app.use("/api/teams", createTeamsRouter(pool));

  // Serve static files from web client (Docker: /app/public, dev: ../../web/dist)
  const webDistPath = process.env.NODE_ENV === "production"
    ? path.join(__dirname, "../../public")
    : path.join(__dirname, "../../web/dist");
  app.use(express.static(webDistPath));

  // SPA fallback — serve index.html for all non-API routes
  app.get("*", (_req, res, next) => {
    const indexPath = path.join(webDistPath, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) next();
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
