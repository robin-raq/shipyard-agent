import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware } from "../middleware/auth.js";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===
const ENTITY_TYPES = ['issue', 'project', 'document', 'ship', 'program', 'comment'] as const;
type EntityType = typeof ENTITY_TYPES[number];

// Database row (snake_case)
interface BacklinkDB {
  id: string;
  source_type: EntityType | string;
  source_id: string;
  target_type: EntityType | string;
  target_id: string;
  created_at: string;
}

// API shape (camelCase)
interface Backlink {
  id: string;
  sourceType: EntityType | string;
  sourceId: string;
  targetType: EntityType | string;
  targetId: string;
  createdAt: string;
}

function mapRow(row: BacklinkDB): Backlink {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    targetType: row.target_type,
    targetId: row.target_id,
    createdAt: row.created_at,
  };
}

export function createBacklinksRouter(pool: pg.Pool): Router {
  const router = Router();
  const auth = createAuthMiddleware(pool);

  // GET /api/backlinks?entity_type=...&entity_id=...
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

      const result = await pool.query<BacklinkDB>(
        `SELECT * FROM backlinks
         WHERE (source_type = $1 AND source_id = $2)
            OR (target_type = $1 AND target_id = $2)
         ORDER BY created_at DESC`,
        [entityType, entityId]
      );

      const backlinks = result.rows.map(mapRow);
      return res.status(200).json(backlinks);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/backlinks
  router.post("/", auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body || {};
      const sourceType: string | undefined = body.sourceType ?? body.source_type;
      const sourceId: string | undefined = body.sourceId ?? body.source_id;
      const targetType: string | undefined = body.targetType ?? body.target_type;
      const targetId: string | undefined = body.targetId ?? body.target_id;

      if (!sourceType || !sourceId || !targetType || !targetId) {
        return res.status(400).json({ error: true, message: "sourceType, sourceId, targetType, and targetId are required", status: 400 });
      }

      if (!(ENTITY_TYPES as readonly string[]).includes(sourceType) || !(ENTITY_TYPES as readonly string[]).includes(targetType)) {
        return res.status(400).json({ error: true, message: "Invalid sourceType or targetType", status: 400 });
      }

      // Prevent exact duplicates
      const existing = await pool.query(
        `SELECT id FROM backlinks
         WHERE source_type = $1 AND source_id = $2 AND target_type = $3 AND target_id = $4
         LIMIT 1`,
        [sourceType, sourceId, targetType, targetId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: true, message: "Backlink already exists", status: 409 });
      }

      const insert = await pool.query<BacklinkDB>(
        `INSERT INTO backlinks (source_type, source_id, target_type, target_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [sourceType, sourceId, targetType, targetId]
      );

      return res.status(201).json(mapRow(insert.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/backlinks/:id
  router.delete("/:id", auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const result = await pool.query(`DELETE FROM backlinks WHERE id = $1`, [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: true, message: "Backlink not found", status: 404 });
      }

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
