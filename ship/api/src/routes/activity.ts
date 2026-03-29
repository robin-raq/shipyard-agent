import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware } from "../middleware/auth.js";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===
const ACTIONS = ['created', 'updated', 'deleted', 'commented', 'status_changed', 'assigned'] as const;
const ENTITY_TYPES = ['issue', 'project', 'document', 'comment', 'standup', 'weekly_plan', 'weekly_retro'] as const;

type Action = typeof ACTIONS[number];
type EntityType = typeof ENTITY_TYPES[number];

interface ActivityLog {
  id: string;
  userId: string;
  action: Action;
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  metadata: Record<string, any>;
  createdAt: string;
}

function rowToActivity(row: any): ActivityLog {
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityTitle: row.entity_title,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

function parseLimitOffset(q: any) {
  let limit = 50;
  let offset = 0;
  if (q.limit !== undefined) {
    const n = parseInt(q.limit as string, 10);
    if (!Number.isNaN(n) && n >= 0) limit = Math.min(n, 200);
  }
  if (q.offset !== undefined) {
    const n = parseInt(q.offset as string, 10);
    if (!Number.isNaN(n) && n >= 0) offset = n;
  }
  return { limit, offset };
}

export function createActivityRouter(pool: pg.Pool): Router {
  const router = Router();
  const auth = createAuthMiddleware(pool);

  // Require auth for all activity routes
  router.use(auth);

  // GET / - list activities with optional filters and pagination
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Support both snake_case and camelCase query param names
      const entityType = (req.query.entity_type as string) ?? (req.query.entityType as string);
      const userId = (req.query.user_id as string) ?? (req.query.userId as string);
      const { limit, offset } = parseLimitOffset(req.query);

      const where: string[] = [];
      const params: any[] = [];
      let i = 1;

      if (entityType) {
        if (!ENTITY_TYPES.includes(entityType as EntityType)) {
          return res.status(400).json({ error: true, message: "Invalid entity_type", status: 400 });
        }
        where.push(`entity_type = $${i++}`);
        params.push(entityType);
      }

      if (userId) {
        where.push(`user_id = $${i++}`);
        params.push(userId);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      // Get total count
      const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM activity_log ${whereSql}`, params);
      const total = countResult.rows[0]?.count ?? 0;

      // Fetch page of activities
      const listParams = [...params, limit, offset];
      const listSql = `
        SELECT id, user_id, action, entity_type, entity_id, entity_title, metadata, created_at
        FROM activity_log
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${i++} OFFSET $${i++}
      `;
      const listResult = await pool.query(listSql, listParams);

      const activities: ActivityLog[] = listResult.rows.map(rowToActivity);
      res.status(200).json({ activities, total });
    } catch (err) {
      next(err);
    }
  });

  // GET /mine - list current user's activities
  router.get("/mine", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, offset } = parseLimitOffset(req.query);
      const userId = req.user!.id;

      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS count FROM activity_log WHERE user_id = $1`,
        [userId]
      );
      const total = countResult.rows[0]?.count ?? 0;

      const result = await pool.query(
        `SELECT id, user_id, action, entity_type, entity_id, entity_title, metadata, created_at
         FROM activity_log
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const activities: ActivityLog[] = result.rows.map(rowToActivity);
      res.status(200).json({ activities, total });
    } catch (err) {
      next(err);
    }
  });

  // POST / - create a new activity log entry
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body || {};
      // Accept both camelCase and snake_case body fields
      const action: Action = body.action;
      const entityType: EntityType = body.entityType ?? body.entity_type;
      const entityId: string = body.entityId ?? body.entity_id;
      const entityTitle: string = body.entityTitle ?? body.entity_title;
      const metadata: Record<string, any> | null = body.metadata ?? null;

      if (!action || !ACTIONS.includes(action)) {
        return res.status(400).json({ error: true, message: "Invalid action", status: 400 });
      }
      if (!entityType || !ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({ error: true, message: "Invalid entityType", status: 400 });
      }
      if (!entityId) {
        return res.status(400).json({ error: true, message: "entityId is required", status: 400 });
      }
      if (!entityTitle) {
        return res.status(400).json({ error: true, message: "entityTitle is required", status: 400 });
      }

      await pool.query(
        `INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_title, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user!.id, action, entityType, entityId, entityTitle, metadata]
      );

      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
