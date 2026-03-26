import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";

const VALID_ENTITY_TYPES = ["issue", "doc", "project", "week", "team"];
const MAX_CONTENT_LENGTH = 10000;
const MAX_AUTHOR_NAME_LENGTH = 255;

export function createCommentsRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET / - list all comments with optional filters
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entity_type, entity_id } = req.query;

      let query = "SELECT * FROM comments WHERE deleted_at IS NULL";
      const params: any[] = [];
      let paramCount = 1;

      if (entity_type) {
        query += ` AND entity_type = $${paramCount++}`;
        params.push(entity_type);
      }

      if (entity_id) {
        query += ` AND entity_id = $${paramCount++}`;
        params.push(entity_id);
      }

      query += " ORDER BY created_at DESC";

      const result = await pool.query(query, params);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // GET /:id - get single comment by id
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        "SELECT * FROM comments WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Comment not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // POST / - create new comment
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entity_type, entity_id, content, author_name } = req.body;

      // Validate required fields
      if (!entity_type) {
        return res.status(400).json({
          error: true,
          message: "entity_type is required",
          status: 400,
        });
      }

      if (!entity_id) {
        return res.status(400).json({
          error: true,
          message: "entity_id is required",
          status: 400,
        });
      }

      if (!content) {
        return res.status(400).json({
          error: true,
          message: "content is required",
          status: 400,
        });
      }

      // Validate entity_type
      if (!VALID_ENTITY_TYPES.includes(entity_type)) {
        return res.status(400).json({
          error: true,
          message: "Invalid entity_type",
          status: 400,
        });
      }

      // Trim and validate content
      const trimmedContent = content.trim();
      if (trimmedContent.length === 0) {
        return res.status(400).json({
          error: true,
          message: "content cannot be empty",
          status: 400,
        });
      }

      if (trimmedContent.length > MAX_CONTENT_LENGTH) {
        return res.status(400).json({
          error: true,
          message: `content is too long (max ${MAX_CONTENT_LENGTH} characters)`,
          status: 400,
        });
      }

      // Validate author_name if provided
      if (author_name && author_name.length > MAX_AUTHOR_NAME_LENGTH) {
        return res.status(400).json({
          error: true,
          message: `author_name is too long (max ${MAX_AUTHOR_NAME_LENGTH} characters)`,
          status: 400,
        });
      }

      const result = await pool.query(
        `INSERT INTO comments (entity_type, entity_id, content, author_name)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [entity_type, entity_id, trimmedContent, author_name || "Anonymous"]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id - update comment
  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { content, author_name } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (content !== undefined) {
        const trimmedContent = content.trim();
        if (trimmedContent.length === 0) {
          return res.status(400).json({
            error: true,
            message: "content cannot be empty",
            status: 400,
          });
        }

        if (trimmedContent.length > MAX_CONTENT_LENGTH) {
          return res.status(400).json({
            error: true,
            message: `content is too long (max ${MAX_CONTENT_LENGTH} characters)`,
            status: 400,
          });
        }

        updates.push(`content = $${paramCount++}`);
        params.push(trimmedContent);
      }

      if (author_name !== undefined) {
        if (author_name.length > MAX_AUTHOR_NAME_LENGTH) {
          return res.status(400).json({
            error: true,
            message: `author_name is too long (max ${MAX_AUTHOR_NAME_LENGTH} characters)`,
            status: 400,
          });
        }

        updates.push(`author_name = $${paramCount++}`);
        params.push(author_name);
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
        `UPDATE comments
         SET ${updates.join(", ")}
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Comment not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /:id - partially update comment
  router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { content, author_name } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (content !== undefined) {
        const trimmedContent = content.trim();
        if (trimmedContent.length === 0) {
          return res.status(400).json({
            error: true,
            message: "content cannot be empty",
            status: 400,
          });
        }

        if (trimmedContent.length > MAX_CONTENT_LENGTH) {
          return res.status(400).json({
            error: true,
            message: `content is too long (max ${MAX_CONTENT_LENGTH} characters)`,
            status: 400,
          });
        }

        updates.push(`content = $${paramCount++}`);
        params.push(trimmedContent);
      }

      if (author_name !== undefined) {
        if (author_name.length > MAX_AUTHOR_NAME_LENGTH) {
          return res.status(400).json({
            error: true,
            message: `author_name is too long (max ${MAX_AUTHOR_NAME_LENGTH} characters)`,
            status: 400,
          });
        }

        updates.push(`author_name = $${paramCount++}`);
        params.push(author_name);
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
        `UPDATE comments
         SET ${updates.join(", ")}
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Comment not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id - soft delete comment
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE comments
         SET deleted_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Comment not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // POST /:id/resolve - mark comment as resolved
  router.post("/:id/resolve", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE comments
         SET resolved = TRUE, updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL AND resolved = FALSE
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Comment not found or already resolved",
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

// Helper function to create nested comments routes for entity routers
export function createNestedCommentsRoutes(
  pool: pg.Pool,
  entityType: string,
  entityTable: string
): Router {
  const router = Router();

  // GET /:entity_id/comments - get all comments for an entity
  router.get(
    "/:entity_id/comments",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { entity_id } = req.params;

        // Check if entity exists
        const entityCheck = await pool.query(
          `SELECT id FROM ${entityTable} WHERE id = $1 AND deleted_at IS NULL`,
          [entity_id]
        );

        if (entityCheck.rows.length === 0) {
          return res.status(404).json({
            error: true,
            message: `${entityType} not found`,
            status: 404,
          });
        }

        // Get comments
        const result = await pool.query(
          `SELECT * FROM comments 
           WHERE entity_type = $1 AND entity_id = $2 AND deleted_at IS NULL
           ORDER BY created_at DESC`,
          [entityType, entity_id]
        );

        res.status(200).json(result.rows);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /:entity_id/comments - create a comment for an entity
  router.post(
    "/:entity_id/comments",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { entity_id } = req.params;
        const { content, author_name } = req.body;

        // Check if entity exists
        const entityCheck = await pool.query(
          `SELECT id FROM ${entityTable} WHERE id = $1 AND deleted_at IS NULL`,
          [entity_id]
        );

        if (entityCheck.rows.length === 0) {
          return res.status(404).json({
            error: true,
            message: `${entityType} not found`,
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

        if (trimmedContent.length > MAX_CONTENT_LENGTH) {
          return res.status(400).json({
            error: true,
            message: `content is too long (max ${MAX_CONTENT_LENGTH} characters)`,
            status: 400,
          });
        }

        // Validate author_name if provided
        if (author_name && author_name.length > MAX_AUTHOR_NAME_LENGTH) {
          return res.status(400).json({
            error: true,
            message: `author_name is too long (max ${MAX_AUTHOR_NAME_LENGTH} characters)`,
            status: 400,
          });
        }

        // Create comment
        const result = await pool.query(
          `INSERT INTO comments (entity_type, entity_id, content, author_name)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [entityType, entity_id, trimmedContent, author_name || "Anonymous"]
        );

        res.status(201).json(result.rows[0]);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
