import express from "express";
import type { Request, Response } from "express";
import type pg from "pg";
import { randomUUID } from "crypto";
import { createAuthMiddleware } from "../middleware/auth.js";

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

  const auth = createAuthMiddleware(pool);
  router.use(auth);

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
      const userId = req.user!.id;
      // Ensure column exist usage according to contract
      const sql = `SELECT ${SETUP_COMPLETED_COLUMN} FROM ${USER_SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`;
      const { rows } = await pool.query(sql, [userId]);
      const completedFlag = mapCompleted(rows[0]);

      // Reflect actual data state for each step
      let teamExists = false;
      let projectExists = false;
      let standupExists = false;
      try {
        teamExists = (await pool.query(
          `SELECT 1 FROM teams WHERE deleted_at IS NULL LIMIT 1`
        )).rows.length > 0;
      } catch {}
      try {
        projectExists = (await pool.query(
          `SELECT 1 FROM projects WHERE deleted_at IS NULL LIMIT 1`
        )).rows.length > 0;
      } catch {}
      try {
        standupExists = (await pool.query(
          `SELECT 1 FROM standups WHERE user_id = $1 LIMIT 1`,
          [userId]
        )).rows.length > 0;
      } catch {}

      const completed = completedFlag || (teamExists && projectExists && standupExists);

      const steps = [
        { name: 'create_team', label: 'Create a Team', done: completed || teamExists },
        { name: 'create_project', label: 'Create a Project', done: completed || projectExists },
        { name: 'first_standup', label: 'Submit First Standup', done: completed || standupExists },
      ];

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
      const userId = req.user!.id;

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
