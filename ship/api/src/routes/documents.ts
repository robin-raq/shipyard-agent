import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createNestedCommentsRoutes } from "./comments.js";

const VALID_DOCUMENT_TYPES = ["doc", "issue", "project", "week", "team", "ship"];

export function createDocumentsRouter(pool: pg.Pool): Router {
  const router = Router();

  // GET / - list documents with optional type and status filters
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, status } = req.query;

      let query = "SELECT * FROM documents WHERE deleted_at IS NULL";
      const params: string[] = [];
      let paramCount = 1;

      if (type) {
        if (!VALID_DOCUMENT_TYPES.includes(type as string)) {
          return res.status(400).json({
            error: true,
            message: "Invalid document type",
            status: 400,
          });
        }
        query += ` AND document_type = $${paramCount}`;
        params.push(type as string);
        paramCount++;
      }

      if (status) {
        query += ` AND status = $${paramCount}`;
        params.push(status as string);
        paramCount++;
      }

      query += " ORDER BY created_at DESC";

      const result = await pool.query(query, params);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // GET /:id - get single document by id
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        "SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Document not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // POST / - create new document
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, content, document_type } = req.body;

      if (!title) {
        return res.status(400).json({
          error: true,
          message: "Title is required",
          status: 400,
        });
      }

      if (!document_type || !VALID_DOCUMENT_TYPES.includes(document_type)) {
        return res.status(400).json({
          error: true,
          message: "Invalid document type",
          status: 400,
        });
      }

      const result = await pool.query(
        `INSERT INTO documents (title, content, document_type)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [title, content || "", document_type]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id - update document
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
        `UPDATE documents
         SET ${updates.join(", ")}
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Document not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /:id - partial update document
  router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { title, content, properties, status } = req.body;

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

      if (properties !== undefined) {
        updates.push(`properties = $${paramCount++}`);
        params.push(properties);
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
        `UPDATE documents
         SET ${updates.join(", ")}
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Document not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id - soft delete document
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE documents
         SET deleted_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Document not found",
          status: 404,
        });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // GET /:id/associations - get related documents based on associations
  router.get("/:id/associations", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Check if the document exists
      const documentCheck = await pool.query(
        "SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (documentCheck.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Document not found or already deleted",
          status: 404,
        });
      }

      // Retrieve related documents based on associations
      const associations = await pool.query(
        `SELECT d.*
         FROM document_associations da
         JOIN documents d ON da.related_id = d.id
         WHERE da.document_id = $1 AND d.deleted_at IS NULL`,
        [id]
      );

      res.status(200).json(associations.rows);
    } catch (err) {
      next(err);
    }
  });

  // Mount nested comments routes
  // Note: documents table is deprecated, but we support comments for backward compatibility
  // Comments will use entity_type based on document_type
  router.get("/:id/comments", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Check if document exists
      const docCheck = await pool.query(
        "SELECT id, document_type FROM documents WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (docCheck.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Document not found",
          status: 404,
        });
      }

      const document = docCheck.rows[0];

      // Get comments using the document's type as entity_type
      const result = await pool.query(
        `SELECT * FROM comments 
         WHERE entity_type = $1 AND entity_id = $2 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [document.document_type, id]
      );

      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/comments", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { content, author_name } = req.body;

      // Check if document exists
      const docCheck = await pool.query(
        "SELECT id, document_type FROM documents WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (docCheck.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Document not found",
          status: 404,
        });
      }

      const document = docCheck.rows[0];

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

      // Create comment using the document's type as entity_type
      const result = await pool.query(
        `INSERT INTO comments (entity_type, entity_id, content, author_name)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [document.document_type, id, trimmedContent, author_name || "Anonymous"]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
