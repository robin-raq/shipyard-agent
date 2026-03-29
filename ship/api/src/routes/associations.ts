import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware } from "../middleware/auth.js";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===
const ENTITY_TYPES = ['issue', 'project', 'document', 'ship', 'program', 'team'] as const;
const RELATIONSHIP_TYPES = ['related', 'blocks', 'blocked_by', 'parent', 'child', 'implements', 'depends_on'] as const;

// Database columns (snake_case)
interface AssociationDB {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship: string;
  created_by: string;
  created_at: string;
}

// TypeScript properties (camelCase)
interface Association {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationship: string;
  createdBy: string;
  createdAt: string;
}

export function createAssociationsRouter(pool: pg.Pool): Router {
  const router = Router();
  const auth = createAuthMiddleware(pool);

  function mapRow(row: AssociationDB): Association {
    return {
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      targetType: row.target_type,
      targetId: row.target_id,
      relationship: row.relationship,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  // GET /associations?entity_type=...&entity_id=... -> list associations involving the entity
  router.get("/", auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entityType = req.query.entity_type as string | undefined;
      const entityId = req.query.entity_id as string | undefined;

      if (!entityType || !entityId) {
        return res.status(400).json({ error: true, message: "entity_type and entity_id are required", status: 400 });
      }

      if (!(ENTITY_TYPES as readonly string[]).includes(entityType)) {
        return res.status(400).json({ error: true, message: "Invalid entity_type", status: 400 });
      }

      const result = await pool.query<AssociationDB>(
        `SELECT * FROM associations
         WHERE (source_type = $1 AND source_id = $2)
            OR (target_type = $1 AND target_id = $2)
         ORDER BY created_at DESC`,
        [entityType, entityId]
      );

      const associations = result.rows.map(mapRow);
      return res.status(200).json(associations);
    } catch (err) {
      next(err);
    }
  });

  // POST /associations -> create an association
  router.post("/", auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Accept snake_case per contract; support camelCase for flexibility
      const body = req.body || {};
      const source_type: string | undefined = body.source_type ?? body.sourceType;
      const source_id: string | undefined = body.source_id ?? body.sourceId;
      const target_type: string | undefined = body.target_type ?? body.targetType;
      const target_id: string | undefined = body.target_id ?? body.targetId;
      const relationship: string | undefined = body.relationship;

      if (!source_type || !source_id || !target_type || !target_id || !relationship) {
        return res.status(400).json({ error: true, message: "source_type, source_id, target_type, target_id, and relationship are required", status: 400 });
      }

      if (!(ENTITY_TYPES as readonly string[]).includes(source_type) || !(ENTITY_TYPES as readonly string[]).includes(target_type)) {
        return res.status(400).json({ error: true, message: "Invalid source_type or target_type", status: 400 });
      }

      if (!(RELATIONSHIP_TYPES as readonly string[]).includes(relationship)) {
        return res.status(400).json({ error: true, message: "Invalid relationship", status: 400 });
      }

      // Prevent exact duplicates
      const existing = await pool.query(
        `SELECT id FROM associations
         WHERE source_type = $1 AND source_id = $2 AND target_type = $3 AND target_id = $4 AND relationship = $5
         LIMIT 1`,
        [source_type, source_id, target_type, target_id, relationship]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: true, message: "Association already exists", status: 409 });
      }

      const createdBy = req.user?.id as string;
      const insert = await pool.query<AssociationDB>(
        `INSERT INTO associations (source_type, source_id, target_type, target_id, relationship, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [source_type, source_id, target_type, target_id, relationship, createdBy]
      );

      return res.status(201).json(mapRow(insert.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  // DELETE /associations/:id -> delete an association
  router.delete("/:id", auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const result = await pool.query(`DELETE FROM associations WHERE id = $1`, [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: true, message: "Association not found", status: 404 });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
