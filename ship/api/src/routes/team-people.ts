import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware } from "../middleware/auth.js";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===
// Backend response type
export interface TeamPeopleResponse {
  people: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    role: string;
    reportsTo: string | null;
  }>;
}

// Factory function pattern
export function createTeamPeopleRouter(pool: pg.Pool): Router {
  const router = Router();
  const auth = createAuthMiddleware(pool);
  router.use(auth);

  // GET /api/team/people
  router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Return all users as active team members (no soft-delete column on users in current schema)
      const { rows } = await pool.query(
        "SELECT id, username, email, role, reports_to FROM users ORDER BY username ASC"
      );

      const people: TeamPeopleResponse["people"] = rows.map((r: any) => ({
        id: r.id as string,
        userId: r.id as string,
        name: r.username as string,
        email: r.email as string,
        role: r.role as string,
        reportsTo: (r.reports_to as string) ?? null,
      }));

      const payload: TeamPeopleResponse = { people };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
