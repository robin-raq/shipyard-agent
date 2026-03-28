import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";

export function createAccountabilityRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET / - list weeks
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = `SELECT * FROM weeks WHERE deleted_at IS NULL ORDER BY created_at DESC`;
      const result = await pool.query(query);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // GET /:id - get single week by id
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        "SELECT * FROM weeks WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Week not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // POST / - create new week
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, content } = req.body;

      if (!title) {
        return res.status(400).json({
          error: true,
          message: "Title is required",
          status: 400,
        });
      }

      if (title.trim().length === 0) {
        return res.status(400).json({
          error: true,
          message: "Title cannot be empty",
          status: 400,
        });
      }

      const result = await pool.query(
        `INSERT INTO weeks (title, content)
         VALUES ($1, $2)
         RETURNING *`,
        [title, content || ""]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id - update week
  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { title, content } = req.body;

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
        `UPDATE weeks
         SET ${updates.join(", ")}
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Week not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id - soft delete week
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE weeks
         SET deleted_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Week not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // GET /:id/comments - get comments for a week
  router.get("/:id/comments", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Check if week exists
      const weekCheck = await pool.query(
        "SELECT id FROM weeks WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (weekCheck.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Week not found",
          status: 404,
        });
      }

      // Get comments for this week
      const result = await pool.query(
        `SELECT * FROM comments 
         WHERE entity_type = $1 AND entity_id = $2 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        ["week", id]
      );

      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // POST /:id/comments - create a comment for a week
  router.post("/:id/comments", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { content, author_name } = req.body;

      // Check if week exists
      const weekCheck = await pool.query(
        "SELECT id FROM weeks WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (weekCheck.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Week not found",
          status: 404,
        });
      }

      // Validate content
      if (!content) {
        return res.status(400).json({
          error: true,
          message: "content is required",
          status: 400,
        });
      }

      const trimmedContent = content.trim();
      if (trimmedContent.length === 0) {
        return res.status(400).json({
          error: true,
          message: "content cannot be empty",
          status: 400,
        });
      }

      if (trimmedContent.length > 10000) {
        return res.status(400).json({
          error: true,
          message: "content is too long (max 10000 characters)",
          status: 400,
        });
      }

      // Validate author_name if provided
      if (author_name && author_name.length > 255) {
        return res.status(400).json({
          error: true,
          message: "author_name is too long (max 255 characters)",
          status: 400,
        });
      }

      // Create comment
      const result = await pool.query(
        `INSERT INTO comments (entity_type, entity_id, content, author_name)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        ["week", id, trimmedContent, author_name || "Anonymous"]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
