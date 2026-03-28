import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";

export function createFeedbackRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET / - list feedback (no auth required for reading)
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.query;
      let query = "SELECT * FROM feedback";
      const params: string[] = [];

      if (status) {
        query += " WHERE status = $1";
        params.push(status as string);
      }

      query += " ORDER BY created_at DESC";
      const result = await pool.query(query, params);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // POST / - submit feedback (public, no auth)
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, title, message } = req.body;

      if (!title) {
        return res.status(400).json({ error: true, message: "Title is required", status: 400 });
      }

      const result = await pool.query(
        `INSERT INTO feedback (name, email, title, message)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name || "Anonymous", email || null, title, message || ""]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
