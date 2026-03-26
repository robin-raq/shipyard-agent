import express, { Express } from "express";
import cors from "cors";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";
import { createDocumentsRouter } from "./routes/documents.js";
import { createDocsRouter } from "./routes/docs.js";
import { createIssuesRouter } from "./routes/issues.js";
import { createProjectsRouter } from "./routes/projects.js";
import { createWeeksRouter } from "./routes/weeks.js";
import { createTeamsRouter } from "./routes/teams.js";
import { createShipsRouter } from "./routes/ships.js";
import { createAuthRouter } from "./routes/auth.js";
import { createProgramsRouter } from "./routes/programs.js";
import { createCommentsRouter } from "./routes/comments.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createSearchRouter } from "./routes/search.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(pool: pg.Pool): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check endpoint (no database dependency)
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Routes
  app.use("/api/auth", createAuthRouter(pool));
  app.use("/api/documents", createDocumentsRouter(pool)); // backward compatibility
  app.use("/api/docs", createDocsRouter(pool));
  app.use("/api/issues", createIssuesRouter(pool));
  app.use("/api/projects", createProjectsRouter(pool));
  app.use("/api/weeks", createWeeksRouter(pool));
  app.use("/api/teams", createTeamsRouter(pool));
  app.use("/api/ships", createShipsRouter(pool));
  app.use("/api/programs", createProgramsRouter(pool));
  app.use("/api/comments", createCommentsRouter(pool));
  app.use("/api/dashboard", createDashboardRouter(pool));
  app.use("/api/search", createSearchRouter(pool));

  // API Documentation
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Serve static files from web client (Docker: /app/public, dev: ../../web/dist)
  const webDistPath = process.env.NODE_ENV === "production"
    ? path.join(__dirname, "../../public")
    : path.join(__dirname, "../../web/dist");
  app.use(express.static(webDistPath));

  // SPA fallback — serve index.html for all non-API routes
  app.get("*", (req, res, next) => {
    // Skip SPA fallback for API routes
    if (req.path.startsWith("/api/")) {
      return next();
    }
    const indexPath = path.join(webDistPath, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) next();
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
