import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware } from "../middleware/auth.js";

const VALID_STATUSES = ["draft", "submitted", "approved", "changes_requested"];

export function createWeeklyRetrosRouter(pool: pg.Pool): Router {
  const router = Router();
  const auth = createAuthMiddleware(pool);
  router.use(auth);

  // GET / - list retros with optional filters
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { week_id, user_id, status } = req.query;

      let query = `
        SELECT wr.*, u.username
        FROM weekly_retros wr
        JOIN users u ON wr.user_id = u.id
        WHERE wr.deleted_at IS NULL`;
      const params: string[] = [];
      let paramCount = 1;

      if (week_id) {
        query += ` AND wr.week_id = $${paramCount++}`;
        params.push(week_id as string);
      }
      if (user_id) {
        query += ` AND wr.user_id = $${paramCount++}`;
        params.push(user_id as string);
      }
      if (status) {
        if (!VALID_STATUSES.includes(status as string)) {
          return res.status(400).json({ error: true, message: "Invalid status", status: 400 });
        }
        query += ` AND wr.status = $${paramCount++}`;
        params.push(status as string);
      }

      query += " ORDER BY wr.created_at DESC";

      const result = await pool.query(query, params);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // GET /:id - single retro
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT wr.*, u.username
         FROM weekly_retros wr
         JOIN users u ON wr.user_id = u.id
         WHERE wr.id = $1 AND wr.deleted_at IS NULL`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Retro not found", status: 404 });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // POST / - create retro (upsert per user/week)
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { week_id, plan_id, went_well, to_improve, action_items } = req.body;

      const result = await pool.query(
        `INSERT INTO weekly_retros (user_id, week_id, plan_id, went_well, to_improve, action_items)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, week_id)
         DO UPDATE SET went_well = $4, to_improve = $5, action_items = $6, plan_id = $3, updated_at = NOW()
         RETURNING *`,
        [req.user!.id, week_id || null, plan_id || null, went_well || "", to_improve || "", action_items || ""]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id - update retro (author only)
  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const check = await pool.query(
        "SELECT user_id FROM weekly_retros WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Retro not found", status: 404 });
      }
      if (check.rows[0].user_id !== req.user!.id) {
        return res.status(403).json({ error: true, message: "Not authorized", status: 403 });
      }

      const { went_well, to_improve, action_items } = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (went_well !== undefined) { updates.push(`went_well = $${paramCount++}`); params.push(went_well); }
      if (to_improve !== undefined) { updates.push(`to_improve = $${paramCount++}`); params.push(to_improve); }
      if (action_items !== undefined) { updates.push(`action_items = $${paramCount++}`); params.push(action_items); }

      if (updates.length === 0) {
        return res.status(400).json({ error: true, message: "No fields to update", status: 400 });
      }

      updates.push("updated_at = NOW()");
      params.push(id);

      const result = await pool.query(
        `UPDATE weekly_retros SET ${updates.join(", ")} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`,
        params
      );

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /:id/submit - submit retro
  router.patch("/:id/submit", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const check = await pool.query(
        "SELECT user_id FROM weekly_retros WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Retro not found", status: 404 });
      }
      if (check.rows[0].user_id !== req.user!.id) {
        return res.status(403).json({ error: true, message: "Not authorized", status: 403 });
      }

      const result = await pool.query(
        `UPDATE weekly_retros SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
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
        "SELECT user_id FROM weekly_retros WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Retro not found", status: 404 });
      }
      if (check.rows[0].user_id !== req.user!.id) {
        return res.status(403).json({ error: true, message: "Not authorized", status: 403 });
      }

      await pool.query("UPDATE weekly_retros SET deleted_at = NOW() WHERE id = $1", [id]);
      res.status(200).json({ message: "Retro deleted" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
