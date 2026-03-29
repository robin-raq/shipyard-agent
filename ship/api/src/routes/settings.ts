import express from 'express';
import type { Request, Response } from 'express';
import type pg from 'pg';
import { randomUUID } from 'crypto';
import { createAuthMiddleware } from '../middleware/auth.js';

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===

// 1. Enum values / constants
const THEME_VALUES = ['light', 'dark', 'system'] as const;
const EMAIL_DIGEST_VALUES = ['none', 'daily', 'weekly'] as const;
const DEFAULT_VIEW_VALUES = ['list', 'kanban', 'calendar'] as const;
const TIMEZONE_VALUES = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'] as const;

// 2. Field names / database columns
// Database columns (snake_case)
const DB_COLUMNS = {
  id: 'id',
  user_id: 'user_id',
  theme: 'theme',
  notifications_enabled: 'notifications_enabled',
  email_digest: 'email_digest',
  default_view: 'default_view',
  timezone: 'timezone',
  updated_at: 'updated_at'
};

// TypeScript property names (camelCase)
interface UserSettings {
  id: string;
  userId: string;
  theme: typeof THEME_VALUES[number];
  notificationsEnabled: boolean;
  emailDigest: typeof EMAIL_DIGEST_VALUES[number];
  defaultView: typeof DEFAULT_VIEW_VALUES[number];
  timezone: typeof TIMEZONE_VALUES[number];
  updatedAt: string;
}

// 3. API endpoints
// Method: GET, Path: /api/settings, Response shape: UserSettings
// Method: PUT, Path: /api/settings, Request body shape: Partial<UserSettings>, Response shape: UserSettings

// 4. Function signatures
// Backend
export function createSettingsRouter(pool: pg.Pool): express.Router {
  const router = express.Router();

  const auth = createAuthMiddleware(pool);
  router.use(auth);

  const DEFAULTS: Omit<UserSettings, 'id' | 'userId' | 'updatedAt'> = {
    theme: 'system',
    notificationsEnabled: true,
    emailDigest: 'weekly',
    defaultView: 'list',
    timezone: 'UTC',
  } as const;

  function mapRow(row: any): UserSettings {
    return {
      id: row[DB_COLUMNS.id],
      userId: row[DB_COLUMNS.user_id],
      theme: row[DB_COLUMNS.theme],
      notificationsEnabled: Boolean(row[DB_COLUMNS.notifications_enabled]),
      emailDigest: row[DB_COLUMNS.email_digest],
      defaultView: row[DB_COLUMNS.default_view],
      timezone: row[DB_COLUMNS.timezone],
      updatedAt: row[DB_COLUMNS.updated_at] instanceof Date
        ? row[DB_COLUMNS.updated_at].toISOString()
        : row[DB_COLUMNS.updated_at],
    } as UserSettings;
  }

  // GET /api/settings
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      const { rows } = await pool.query(
        `SELECT ${DB_COLUMNS.id}, ${DB_COLUMNS.user_id}, ${DB_COLUMNS.theme}, ${DB_COLUMNS.notifications_enabled},
                ${DB_COLUMNS.email_digest}, ${DB_COLUMNS.default_view}, ${DB_COLUMNS.timezone}, ${DB_COLUMNS.updated_at}
         FROM user_settings WHERE ${DB_COLUMNS.user_id} = $1 LIMIT 1`,
        [userId]
      );

      if (rows.length > 0) {
        return res.json(mapRow(rows[0]));
      }

      // Create settings with defaults if none exist yet
      const id = randomUUID();
      const nowSql = 'NOW()';
      const insertSql = `INSERT INTO user_settings (
          ${DB_COLUMNS.id}, ${DB_COLUMNS.user_id}, ${DB_COLUMNS.theme}, ${DB_COLUMNS.notifications_enabled},
          ${DB_COLUMNS.email_digest}, ${DB_COLUMNS.default_view}, ${DB_COLUMNS.timezone}, ${DB_COLUMNS.updated_at}
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, ${nowSql})
        RETURNING ${DB_COLUMNS.id}, ${DB_COLUMNS.user_id}, ${DB_COLUMNS.theme}, ${DB_COLUMNS.notifications_enabled},
                  ${DB_COLUMNS.email_digest}, ${DB_COLUMNS.default_view}, ${DB_COLUMNS.timezone}, ${DB_COLUMNS.updated_at}`;
      const params = [
        id,
        userId,
        DEFAULTS.theme,
        DEFAULTS.notificationsEnabled,
        DEFAULTS.emailDigest,
        DEFAULTS.defaultView,
        DEFAULTS.timezone,
      ];
      const insert = await pool.query(insertSql, params);
      return res.json(mapRow(insert.rows[0]));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching user settings', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /api/settings
  router.put('/', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { theme, notificationsEnabled, emailDigest, defaultView, timezone } = (req.body || {}) as Partial<UserSettings>;

      // Validate
      if (theme !== undefined && !THEME_VALUES.includes(theme as any)) {
        return res.status(400).json({ error: 'Invalid theme' });
      }
      if (emailDigest !== undefined && !EMAIL_DIGEST_VALUES.includes(emailDigest as any)) {
        return res.status(400).json({ error: 'Invalid emailDigest' });
      }
      if (defaultView !== undefined && !DEFAULT_VIEW_VALUES.includes(defaultView as any)) {
        return res.status(400).json({ error: 'Invalid defaultView' });
      }
      if (timezone !== undefined && !TIMEZONE_VALUES.includes(timezone as any)) {
        return res.status(400).json({ error: 'Invalid timezone' });
      }
      if (notificationsEnabled !== undefined && typeof notificationsEnabled !== 'boolean') {
        return res.status(400).json({ error: 'Invalid notificationsEnabled' });
      }

      // Check if exists
      const { rows } = await pool.query(
        `SELECT ${DB_COLUMNS.id} FROM user_settings WHERE ${DB_COLUMNS.user_id} = $1 LIMIT 1`,
        [userId]
      );

      if (rows.length === 0) {
        // Insert new with provided values merged with defaults
        const id = randomUUID();
        const insertSql = `INSERT INTO user_settings (
            ${DB_COLUMNS.id}, ${DB_COLUMNS.user_id}, ${DB_COLUMNS.theme}, ${DB_COLUMNS.notifications_enabled},
            ${DB_COLUMNS.email_digest}, ${DB_COLUMNS.default_view}, ${DB_COLUMNS.timezone}, ${DB_COLUMNS.updated_at}
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          RETURNING ${DB_COLUMNS.id}, ${DB_COLUMNS.user_id}, ${DB_COLUMNS.theme}, ${DB_COLUMNS.notifications_enabled},
                    ${DB_COLUMNS.email_digest}, ${DB_COLUMNS.default_view}, ${DB_COLUMNS.timezone}, ${DB_COLUMNS.updated_at}`;
        const params = [
          id,
          userId,
          theme ?? DEFAULTS.theme,
          notificationsEnabled ?? DEFAULTS.notificationsEnabled,
          emailDigest ?? DEFAULTS.emailDigest,
          defaultView ?? DEFAULTS.defaultView,
          timezone ?? DEFAULTS.timezone,
        ];
        const inserted = await pool.query(insertSql, params);
        return res.json(mapRow(inserted.rows[0]));
      }

      // Update existing
      const sets: string[] = [];
      const params: any[] = [];

      if (theme !== undefined) {
        params.push(theme);
        sets.push(`${DB_COLUMNS.theme} = $${params.length}`);
      }
      if (notificationsEnabled !== undefined) {
        params.push(notificationsEnabled);
        sets.push(`${DB_COLUMNS.notifications_enabled} = $${params.length}`);
      }
      if (emailDigest !== undefined) {
        params.push(emailDigest);
        sets.push(`${DB_COLUMNS.email_digest} = $${params.length}`);
      }
      if (defaultView !== undefined) {
        params.push(defaultView);
        sets.push(`${DB_COLUMNS.default_view} = $${params.length}`);
      }
      if (timezone !== undefined) {
        params.push(timezone);
        sets.push(`${DB_COLUMNS.timezone} = $${params.length}`);
      }

      if (sets.length === 0) {
        // Nothing to update, return current row
        const cur = await pool.query(
          `SELECT ${DB_COLUMNS.id}, ${DB_COLUMNS.user_id}, ${DB_COLUMNS.theme}, ${DB_COLUMNS.notifications_enabled},
                  ${DB_COLUMNS.email_digest}, ${DB_COLUMNS.default_view}, ${DB_COLUMNS.timezone}, ${DB_COLUMNS.updated_at}
           FROM user_settings WHERE ${DB_COLUMNS.user_id} = $1 LIMIT 1`,
          [userId]
        );
        return res.json(mapRow(cur.rows[0]));
      }

      sets.push(`${DB_COLUMNS.updated_at} = NOW()`);
      params.push(userId);

      const updateSql = `UPDATE user_settings SET ${sets.join(', ')} WHERE ${DB_COLUMNS.user_id} = $${params.length}
        RETURNING ${DB_COLUMNS.id}, ${DB_COLUMNS.user_id}, ${DB_COLUMNS.theme}, ${DB_COLUMNS.notifications_enabled},
                  ${DB_COLUMNS.email_digest}, ${DB_COLUMNS.default_view}, ${DB_COLUMNS.timezone}, ${DB_COLUMNS.updated_at}`;

      const updated = await pool.query(updateSql, params);
      return res.json(mapRow(updated.rows[0]));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error updating user settings', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
