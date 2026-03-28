import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware } from "../middleware/auth.js";

export function createStandupsRouter(pool: pg.Pool): Router {
  const router = Router();
  const auth = createAuthMiddleware(pool);
  router.use(auth);

  // GET / - list standups with optional filters
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { date, user_id, from, to } = req.query;

      let query = `
        SELECT s.*, u.username
        FROM standups s
        JOIN users u ON s.user_id = u.id
        WHERE s.deleted_at IS NULL`;
      const params: string[] = [];
      let paramCount = 1;

      if (date) {
        query += ` AND s.standup_date = $${paramCount++}`;
        params.push(date as string);
      }
      if (user_id) {
        query += ` AND s.user_id = $${paramCount++}`;
        params.push(user_id as string);
      }
      if (from) {
        query += ` AND s.standup_date >= $${paramCount++}`;
        params.push(from as string);
      }
      if (to) {
        query += ` AND s.standup_date <= $${paramCount++}`;
        params.push(to as string);
      }

      query += " ORDER BY s.standup_date DESC, s.created_at DESC";

      const result = await pool.query(query, params);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // GET /status - check if current user submitted a standup today
  router.get("/status", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT * FROM standups
         WHERE user_id = $1 AND standup_date = CURRENT_DATE AND deleted_at IS NULL`,
        [req.user!.id]
      );

      if (result.rows.length === 0) {
        res.status(200).json({ due: true });
      } else {
        res.status(200).json({ due: false, standup: result.rows[0] });
      }
    } catch (err) {
      next(err);
    }
  });

  // POST / - create standup (upsert per user/date)
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { yesterday, today, blockers, standup_date } = req.body;

      if (!yesterday && !today) {
        return res.status(400).json({
          error: true,
          message: "Yesterday or today content is required",
          status: 400,
        });
      }

      const result = await pool.query(
        `INSERT INTO standups (user_id, standup_date, yesterday, today, blockers)
         VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5)
         ON CONFLICT (user_id, standup_date)
         DO UPDATE SET yesterday = $3, today = $4, blockers = $5, updated_at = NOW()
         RETURNING *`,
        [req.user!.id, standup_date || null, yesterday || "", today || "", blockers || ""]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id - update standup (author only)
  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Check ownership
      const check = await pool.query(
        "SELECT user_id FROM standups WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Standup not found", status: 404 });
      }
      if (check.rows[0].user_id !== req.user!.id) {
        return res.status(403).json({ error: true, message: "Not authorized", status: 403 });
      }

      const { yesterday, today, blockers } = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (yesterday !== undefined) {
        updates.push(`yesterday = $${paramCount++}`);
        params.push(yesterday);
      }
      if (today !== undefined) {
        updates.push(`today = $${paramCount++}`);
        params.push(today);
      }
      if (blockers !== undefined) {
        updates.push(`blockers = $${paramCount++}`);
        params.push(blockers);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: true, message: "No fields to update", status: 400 });
      }

      updates.push("updated_at = NOW()");
      params.push(id);

      const result = await pool.query(
        `UPDATE standups SET ${updates.join(", ")} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`,
        params
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
        "SELECT user_id FROM standups WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Standup not found", status: 404 });
      }
      if (check.rows[0].user_id !== req.user!.id) {
        return res.status(403).json({ error: true, message: "Not authorized", status: 403 });
      }

      await pool.query(
        "UPDATE standups SET deleted_at = NOW() WHERE id = $1",
        [id]
      );

      res.status(200).json({ message: "Standup deleted" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
