import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";

export function createDocsRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET / - list all docs (optional ?search=term filters title)
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = req.query.search;
      const search = typeof raw === "string" ? raw.trim() : "";
      let sql = "SELECT * FROM docs WHERE deleted_at IS NULL";
      const params: string[] = [];
      if (search) {
        sql += " AND title ILIKE $1";
        params.push(`%${search}%`);
      }
      sql += " ORDER BY created_at DESC";
      const result = await pool.query(sql, params);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // GET /:id - get single doc by id
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        "SELECT * FROM docs WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Doc not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // POST / - create new doc
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

      const contentStr =
        content === undefined || content === null ? "" : String(content);
      if (contentStr.trim() === "") {
        return res.status(400).json({
          error: true,
          message: "Content is required",
          status: 400,
        });
      }

      const result = await pool.query(
        `INSERT INTO docs (title, content)
         VALUES ($1, $2)
         RETURNING *`,
        [title, contentStr]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id - update doc
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
        `UPDATE docs
         SET ${updates.join(", ")}
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Doc not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id - soft delete doc
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE docs
         SET deleted_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Doc not found",
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
