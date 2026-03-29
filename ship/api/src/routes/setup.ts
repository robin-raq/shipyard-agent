import express from "express";
import type { Request, Response } from "express";
import type pg from "pg";
import { randomUUID } from "crypto";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===

// 1. Enum values / constants
const SETUP_STEPS = [
  { name: 'create_team', label: 'Create a Team' },
  { name: 'create_project', label: 'Create a Project' },
  { name: 'first_standup', label: 'Submit First Standup' }
];

// 2. Field names / database columns
// Database columns (snake_case)
const USER_SETTINGS_TABLE = 'user_settings';
const SETUP_COMPLETED_COLUMN = 'setup_completed';

// TypeScript property names (camelCase)
interface UserSettings {
  setupCompleted: boolean;
}

// 3. API endpoints
// GET /api/setup/status
// Response: { completed: boolean, steps: { name: string, label: string, done: boolean }[] }

// POST /api/setup/complete
// Request: {}
// Response: { success: boolean }

// 4. Function signatures
// Backend
export function createSetupRouter(pool: pg.Pool): express.Router {
  const router = express.Router();

  // Auth helpers (follow existing pattern; avoid local UUID regex helpers)
  function getAuthUserId(req: Request): string | undefined {
    const userId: string | undefined = (req as any).user?.id || (req as any).auth?.userId;
    return typeof userId === 'string' && userId.length > 0 ? userId : undefined;
  }

  function requireAuth(req: Request, res: Response, next: express.NextFunction) {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  }

  router.use(requireAuth);

  // Helpers
  function mapCompleted(row: any | undefined): boolean {
    if (!row) return false;
    const v = row[SETUP_COMPLETED_COLUMN];
    if (v === null || v === undefined) return false;
    return Boolean(v);
  }

  // GET /api/setup/status
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req)!;
      // Ensure column exist usage according to contract
      const sql = `SELECT ${SETUP_COMPLETED_COLUMN} FROM ${USER_SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`;
      const { rows } = await pool.query(sql, [userId]);
      const completed = mapCompleted(rows[0]);

      const steps = SETUP_STEPS.map(s => ({ name: s.name, label: s.label, done: completed }));
      const response = { completed, steps } as { completed: boolean, steps: { name: string, label: string, done: boolean }[] };
      return res.json(response);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching setup status', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/setup/complete
  router.post('/complete', async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req)!;

      // Check if settings row exists
      const { rows } = await pool.query(`SELECT id FROM ${USER_SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`, [userId]);

      if (rows.length > 0) {
        // Update existing row
        await pool.query(
          `UPDATE ${USER_SETTINGS_TABLE}
           SET ${SETUP_COMPLETED_COLUMN} = TRUE, updated_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );
      } else {
        // Insert a new settings row with sensible defaults used elsewhere in the app
        const id = randomUUID();
        const DEFAULTS = {
          theme: 'system',
          notifications_enabled: true,
          email_digest: 'weekly',
          default_view: 'list',
          timezone: 'UTC',
        } as const;

        await pool.query(
          `INSERT INTO ${USER_SETTINGS_TABLE} (
            id, user_id, theme, notifications_enabled, email_digest, default_view, timezone, updated_at, ${SETUP_COMPLETED_COLUMN}
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), TRUE)`,
          [id, userId, DEFAULTS.theme, DEFAULTS.notifications_enabled, DEFAULTS.email_digest, DEFAULTS.default_view, DEFAULTS.timezone]
        );
      }

      return res.json({ success: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error completing setup', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

// 5. TypeScript interfaces
interface SetupStatusResponse {
  completed: boolean;
  steps: { name: string, label: string, done: boolean }[];
}

interface CompleteSetupResponse {
  success: boolean;
}
