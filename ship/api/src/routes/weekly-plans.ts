import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware } from "../middleware/auth.js";

const VALID_STATUSES = ["draft", "submitted", "approved", "changes_requested"];

export function createWeeklyPlansRouter(pool: pg.Pool): Router {
  const router = Router();
  const auth = createAuthMiddleware(pool);
  router.use(auth);

  // GET / - list weekly plans with optional filters
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { week_id, user_id, status } = req.query;

      let query = `
        SELECT wp.*, u.username
        FROM weekly_plans wp
        JOIN users u ON wp.user_id = u.id
        WHERE wp.deleted_at IS NULL`;
      const params: string[] = [];
      let paramCount = 1;

      if (week_id) {
        query += ` AND wp.week_id = $${paramCount++}`;
        params.push(week_id as string);
      }
      if (user_id) {
        query += ` AND wp.user_id = $${paramCount++}`;
        params.push(user_id as string);
      }
      if (status) {
        if (!VALID_STATUSES.includes(status as string)) {
          return res.status(400).json({ error: true, message: "Invalid status", status: 400 });
        }
        query += ` AND wp.status = $${paramCount++}`;
        params.push(status as string);
      }

      query += " ORDER BY wp.created_at DESC";

      const result = await pool.query(query, params);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // GET /:id - single plan
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT wp.*, u.username
         FROM weekly_plans wp
         JOIN users u ON wp.user_id = u.id
         WHERE wp.id = $1 AND wp.deleted_at IS NULL`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Plan not found", status: 404 });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // POST / - create plan (upsert per user/week)
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { week_id, plan_content } = req.body;

      const result = await pool.query(
        `INSERT INTO weekly_plans (user_id, week_id, plan_content)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, week_id)
         DO UPDATE SET plan_content = $3, updated_at = NOW()
         RETURNING *`,
        [req.user!.id, week_id || null, plan_content || ""]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id - update plan (author only)
  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const check = await pool.query(
        "SELECT user_id FROM weekly_plans WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Plan not found", status: 404 });
      }
      if (check.rows[0].user_id !== req.user!.id) {
        return res.status(403).json({ error: true, message: "Not authorized", status: 403 });
      }

      const { plan_content } = req.body;
      const result = await pool.query(
        `UPDATE weekly_plans SET plan_content = $1, updated_at = NOW()
         WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
        [plan_content, id]
      );

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /:id/submit - submit plan for review
  router.patch("/:id/submit", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const check = await pool.query(
        "SELECT user_id, status FROM weekly_plans WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Plan not found", status: 404 });
      }
      if (check.rows[0].user_id !== req.user!.id) {
        return res.status(403).json({ error: true, message: "Not authorized", status: 403 });
      }

      const result = await pool.query(
        `UPDATE weekly_plans SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id]
      );

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id - soft delete (author only)
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const check = await pool.query(
        "SELECT user_id FROM weekly_plans WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Plan not found", status: 404 });
      }
      if (check.rows[0].user_id !== req.user!.id) {
        return res.status(403).json({ error: true, message: "Not authorized", status: 403 });
      }

      await pool.query(
        "UPDATE weekly_plans SET deleted_at = NOW() WHERE id = $1",
        [id]
      );

      res.status(200).json({ message: "Plan deleted" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
