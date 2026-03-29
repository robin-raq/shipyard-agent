import express from 'express';
import type { Request, Response } from 'express';
import type pg from 'pg';
import { randomUUID } from 'crypto';
import { createAuthMiddleware } from '../middleware/auth.js';

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===

// 1. Enum values / constants
const NOTIFICATION_TYPES = ['assignment', 'comment', 'review_request', 'review_decision', 'mention', 'status_change'] as const;

// 2. Field names / database columns
// Database columns (snake_case)
interface NotificationDB {
  id: string; // UUID
  user_id: string; // UUID
  type: string; // VARCHAR(30)
  title: string; // VARCHAR(255)
  body: string; // TEXT
  entity_type: string | null; // VARCHAR(30)
  entity_id: string | null; // UUID
  read_at: Date | null; // TIMESTAMPTZ
  created_at: Date; // TIMESTAMPTZ
}

// TypeScript properties (camelCase)
interface Notification {
  id: string;
  userId: string;
  type: typeof NOTIFICATION_TYPES[number];
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

// 3. API endpoints
// GET /api/notifications
// Query params: { unread_only?: boolean, limit?: number, offset?: number }
// Response: { notifications: Notification[], unread_count: number }

// GET /api/notifications/unread-count
// Response: { count: number }

// POST /api/notifications
// Request body: { user_id: string, type: string, title: string, body: string, entity_type?: string, entity_id?: string }
// Response: Notification

// PATCH /api/notifications/:id/read
// Response: void

// PATCH /api/notifications/read-all
// Response: void

// 4. Function signatures
// Backend
export function createNotificationsRouter(pool: pg.Pool): express.Router {
  const router = express.Router();

  const auth = createAuthMiddleware(pool);
  router.use(auth);

  function isValidUUID(v?: string): boolean {
    if (!v) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  function mapRow(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body,
      entityType: row.entity_type ?? null,
      entityId: row.entity_id ?? null,
      readAt: row.read_at ? (row.read_at instanceof Date ? row.read_at : new Date(row.read_at)) : null,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    } as Notification;
  }

  // GET /api/notifications
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      const unreadOnlyRaw = String((req.query.unread_only ?? req.query.unreadOnly) ?? '').toLowerCase();
      const unreadOnly = unreadOnlyRaw === 'true' || unreadOnlyRaw === '1';

      const limitNum = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
      const offsetNum = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

      const whereParts: string[] = ['user_id = $1'];
      const params: any[] = [userId];

      if (unreadOnly) {
        whereParts.push('read_at IS NULL');
      }

      const sql = `SELECT id, user_id, type, title, body, entity_type, entity_id, read_at, created_at
                   FROM notifications
                   WHERE ${whereParts.join(' AND ')}
                   ORDER BY created_at DESC
                   LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limitNum, offsetNum);

      const [rowsResult, unreadCountResult] = await Promise.all([
        pool.query(sql, params),
        pool.query('SELECT COUNT(*)::int AS cnt FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId]),
      ]);

      const notifications: Notification[] = rowsResult.rows.map(mapRow);
      const unread_count: number = Number(unreadCountResult.rows[0]?.cnt ?? 0);

      return res.json({ notifications, unread_count });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching notifications', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/notifications/unread-count
  router.get('/unread-count', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS cnt FROM notifications WHERE user_id = $1 AND read_at IS NULL',
        [userId]
      );
      const count = Number(rows[0]?.cnt ?? 0);
      return res.json({ count });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching unread notifications count', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/notifications
  router.post('/', async (req: Request, res: Response) => {
    try {
      const authUserId = req.user!.id;
      const body = req.body || {};

      const userId: string | undefined = body.userId ?? body.user_id ?? authUserId;
      const type: string = body.type;
      const title: string = body.title;
      const content: string = body.body;
      const entityType: string | undefined = body.entityType ?? body.entity_type;
      const entityId: string | undefined = body.entityId ?? body.entity_id;

      if (!isValidUUID(userId)) {
        return res.status(400).json({ error: 'Invalid or missing userId' });
      }
      if (userId !== authUserId) {
        return res.status(403).json({ error: 'Forbidden: cannot create notifications for another user' });
      }
      if (!type || !NOTIFICATION_TYPES.includes(type as any)) {
        return res.status(400).json({ error: 'Invalid or missing type' });
      }
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing title' });
      }
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing body' });
      }
      if (entityType !== undefined && entityType !== null && typeof entityType !== 'string') {
        return res.status(400).json({ error: 'Invalid entityType' });
      }
      if (entityId !== undefined && entityId !== null && !isValidUUID(String(entityId))) {
        return res.status(400).json({ error: 'Invalid entityId' });
      }

      const id = randomUUID();
      const insertSql = `INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         RETURNING id, user_id, type, title, body, entity_type, entity_id, read_at, created_at`;
      const params = [id, userId, type, title, content, entityType ?? null, entityId ?? null];

      const { rows } = await pool.query<NotificationDB>(insertSql, params);
      const notification = mapRow(rows[0]);
      return res.status(201).json(notification);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error creating notification', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PATCH /api/notifications/:id/read
  router.patch('/:id/read', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid notification id' });
      }

      const { rowCount } = await pool.query(
        'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL',
        [id, userId]
      );

      if (rowCount === 0) {
        // Either not found or already read or not owned by user
        return res.status(404).json({ error: 'Notification not found' });
      }

      return res.status(200).json({});
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error marking notification as read', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PATCH /api/notifications/read-all
  router.patch('/read-all', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      await pool.query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [userId]);
      return res.status(200).json({});
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error marking all notifications as read', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
