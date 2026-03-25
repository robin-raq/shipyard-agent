import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";

const VALID_STATUSES = ["open", "in_progress", "closed"];
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

export function createIssuesRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET / - list all issues with optional status and priority filters
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, priority } = req.query;

      let query = "SELECT * FROM issues WHERE deleted_at IS NULL";
      const params: string[] = [];
      let paramCount = 1;

      if (status) {
        if (!VALID_STATUSES.includes(status as string)) {
          return res.status(400).json({
            error: true,
            message: "Invalid status",
            status: 400,
          });
        }
        query += ` AND status = $${paramCount++}`;
        params.push(status as string);
      }

      if (priority) {
        if (!VALID_PRIORITIES.includes(priority as string)) {
          return res.status(400).json({
            error: true,
            message: "Invalid priority",
            status: 400,
          });
        }
        query += ` AND priority = $${paramCount++}`;
        params.push(priority as string);
      }

      query += " ORDER BY created_at DESC";

      const result = await pool.query(query, params);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // GET /:id - get single issue by id
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        "SELECT * FROM issues WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Issue not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // POST / - create new issue
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, content, status, priority } = req.body;

      if (!title) {
        return res.status(400).json({
          error: true,
          message: "Title is required",
          status: 400,
        });
      }

      if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          error: true,
          message: "Invalid status",
          status: 400,
        });
      }

      if (priority && !VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({
          error: true,
          message: "Invalid priority",
          status: 400,
        });
      }

      const result = await pool.query(
        `INSERT INTO issues (title, content, status, priority)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [title, content || "", status || "open", priority || "medium"]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id - update issue
  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { title, content, status, priority } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        params.push(title);
      }

      if (content !== undefined) {
        updates.push(`content = $${paramCount++}`);
        params.push(content);
      }

      if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) {
          return res.status(400).json({
            error: true,
            message: "Invalid status",
            status: 400,
          });
        }
        updates.push(`status = $${paramCount++}`);
        params.push(status);
      }

      if (priority !== undefined) {
        if (!VALID_PRIORITIES.includes(priority)) {
          return res.status(400).json({
            error: true,
            message: "Invalid priority",
            status: 400,
          });
        }
        updates.push(`priority = $${paramCount++}`);
        params.push(priority);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: true,
          message: "No fields to update",
          status: 400,
        });
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);

      const result = await pool.query(
        `UPDATE issues
         SET ${updates.join(", ")}
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Issue not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id - soft delete issue
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE issues
         SET deleted_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Issue not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
