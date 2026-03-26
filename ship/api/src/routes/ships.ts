import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";

export function createShipsRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET / - list all ships
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = "SELECT * FROM ships WHERE deleted_at IS NULL ORDER BY created_at DESC";
      const result = await pool.query(query);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // GET /:id - get single ship by id
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        "SELECT * FROM ships WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Ship not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // POST / - create new ship
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, status } = req.body;

      if (!name) {
        return res.status(400).json({
          error: true,
          message: "Name is required",
          status: 400,
        });
      }

      const result = await pool.query(
        `INSERT INTO ships (name, description, status)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, description || null, status || "active"]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id - update ship
  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description, status } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        params.push(name);
      }

      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        params.push(description);
      }

      if (status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        params.push(status);
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
        `UPDATE ships
         SET ${updates.join(", ")}
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Ship not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id - soft delete ship
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE ships
         SET deleted_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Ship not found",
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
