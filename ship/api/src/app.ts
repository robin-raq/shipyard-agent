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
import { createAccountabilityRouter } from "./routes/accountability.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createStandupsRouter } from "./routes/standups.js";
import { createWeeklyPlansRouter } from "./routes/weekly-plans.js";
import { createWeeklyRetrosRouter } from "./routes/weekly-retros.js";
import { createReviewsRouter } from "./routes/reviews.js";
import { createFeedbackRouter } from "./routes/feedback.js";

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
  app.use("/api/accountability", createAccountabilityRouter(pool));

  app.use("/api/standups", createStandupsRouter(pool));
  app.use("/api/weekly-plans", createWeeklyPlansRouter(pool));
  app.use("/api/weekly-retros", createWeeklyRetrosRouter(pool));
  app.use("/api/reviews", createReviewsRouter(pool));
  app.use("/api/feedback", createFeedbackRouter(pool));

// API Documentation
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Serve static files from web client (Docker: /app/public, dev: ../../web/dist)
  const webDistPath = process.env.NODE_ENV === "production"
    ? path.join(__dirname, "../../public")
    : path.join(__dirname, "../../web/dist");
  app.use(express.static(webDistPath, {
    // Cache JS/CSS with hashed names for 1 year, but never cache index.html
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));

  // SPA fallback — serve index.html for frontend routes only
  app.get("*", (req, res, next) => {
    // Skip SPA fallback for API routes, health, and docs
    if (req.path.startsWith("/api") || req.path === "/health" || req.path.startsWith("/api-docs")) {
      return next();
    }
    const indexPath = path.join(webDistPath, "index.html");
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(indexPath, (err) => {
      if (err) next();
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
