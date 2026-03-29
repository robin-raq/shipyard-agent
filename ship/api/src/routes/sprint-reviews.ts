import express from 'express';
import type { Request, Response } from 'express';
import type pg from 'pg';
import { randomUUID } from 'crypto';

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===

// 1. Enum values / constants
const STATUS_DRAFT = 'draft';
const STATUS_SUBMITTED = 'submitted';
const STATUS_FINALIZED = 'finalized';
const STATUS_VALUES = [STATUS_DRAFT, STATUS_SUBMITTED, STATUS_FINALIZED] as const;

// 2. Field names / database columns
// Database columns (snake_case)
const DB_COLUMNS = {
  id: 'id',
  weekId: 'week_id',
  authorId: 'author_id',
  summary: 'summary',
  accomplishments: 'accomplishments',
  challenges: 'challenges',
  nextSteps: 'next_steps',
  teamRating: 'team_rating',
  status: 'status',
  submittedAt: 'submitted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at'
} as const;

// TypeScript property names (camelCase)
interface SprintReview {
  id: string;
  weekId: string;
  authorId: string;
  summary: string;
  accomplishments: string;
  challenges: string;
  nextSteps: string;
  teamRating: number;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface GetSprintReviewsQuery {
  week_id?: string;
  status?: string;
  author_id?: string;
}

interface CreateSprintReviewRequest {
  weekId: string;
  summary: string;
  accomplishments: string;
  challenges: string;
  nextSteps: string;
  teamRating: number;
}

function mapRowToSprintReview(row: any): SprintReview {
  return {
    id: row[DB_COLUMNS.id],
    weekId: row[DB_COLUMNS.weekId],
    authorId: row[DB_COLUMNS.authorId],
    summary: row[DB_COLUMNS.summary],
    accomplishments: row[DB_COLUMNS.accomplishments],
    challenges: row[DB_COLUMNS.challenges],
    nextSteps: row[DB_COLUMNS.nextSteps],
    teamRating: Number(row[DB_COLUMNS.teamRating]),
    status: row[DB_COLUMNS.status],
    submittedAt: row[DB_COLUMNS.submittedAt]
      ? (row[DB_COLUMNS.submittedAt] instanceof Date
          ? row[DB_COLUMNS.submittedAt].toISOString()
          : row[DB_COLUMNS.submittedAt])
      : null,
    createdAt: row[DB_COLUMNS.createdAt] instanceof Date
      ? row[DB_COLUMNS.createdAt].toISOString()
      : row[DB_COLUMNS.createdAt],
    updatedAt: row[DB_COLUMNS.updatedAt] instanceof Date
      ? row[DB_COLUMNS.updatedAt].toISOString()
      : row[DB_COLUMNS.updatedAt],
    deletedAt: row[DB_COLUMNS.deletedAt]
      ? (row[DB_COLUMNS.deletedAt] instanceof Date
          ? row[DB_COLUMNS.deletedAt].toISOString()
          : row[DB_COLUMNS.deletedAt])
      : null,
  };
}

function isValidUUID(v?: string): boolean {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function getAuthUserId(req: Request): string | undefined {
  const userId: string | undefined = (req as any).user?.id || (req as any).auth?.userId;
  return isValidUUID(userId) ? userId : undefined;
}

function requireAuth(req: Request, res: Response, next: express.NextFunction) {
  const userId = getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

export function createSprintReviewsRouter(pool: pg.Pool): express.Router {
  const router = express.Router();

  // All sprint review routes require authentication
  router.use(requireAuth);

  // GET /api/sprint-reviews
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { week_id, status, author_id } = (req.query || {}) as GetSprintReviewsQuery;

      const where: string[] = ['deleted_at IS NULL'];
      const params: any[] = [];

      if (week_id) {
        if (!isValidUUID(String(week_id))) {
          return res.status(400).json({ error: 'Invalid week_id' });
        }
        params.push(String(week_id));
        where.push(`${DB_COLUMNS.weekId} = $${params.length}`);
      }

      if (author_id) {
        if (!isValidUUID(String(author_id))) {
          return res.status(400).json({ error: 'Invalid author_id' });
        }
        params.push(String(author_id));
        where.push(`${DB_COLUMNS.authorId} = $${params.length}`);
      }

      if (status) {
        if (!STATUS_VALUES.includes(status as any)) {
          return res.status(400).json({ error: 'Invalid status' });
        }
        params.push(String(status));
        where.push(`${DB_COLUMNS.status} = $${params.length}`);
      }

      const sql = `
        SELECT ${DB_COLUMNS.id}, ${DB_COLUMNS.weekId}, ${DB_COLUMNS.authorId}, ${DB_COLUMNS.summary},
               ${DB_COLUMNS.accomplishments}, ${DB_COLUMNS.challenges}, ${DB_COLUMNS.nextSteps},
               ${DB_COLUMNS.teamRating}, ${DB_COLUMNS.status}, ${DB_COLUMNS.submittedAt},
               ${DB_COLUMNS.createdAt}, ${DB_COLUMNS.updatedAt}, ${DB_COLUMNS.deletedAt}
        FROM sprint_reviews
        WHERE ${where.join(' AND ')}
        ORDER BY ${DB_COLUMNS.createdAt} DESC`;

      const { rows } = await pool.query(sql, params);
      return res.json(rows.map(mapRowToSprintReview));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching sprint reviews', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/sprint-reviews/:id
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid review id' });
      }

      const { rows } = await pool.query(
        `SELECT ${DB_COLUMNS.id}, ${DB_COLUMNS.weekId}, ${DB_COLUMNS.authorId}, ${DB_COLUMNS.summary},
                ${DB_COLUMNS.accomplishments}, ${DB_COLUMNS.challenges}, ${DB_COLUMNS.nextSteps},
                ${DB_COLUMNS.teamRating}, ${DB_COLUMNS.status}, ${DB_COLUMNS.submittedAt},
                ${DB_COLUMNS.createdAt}, ${DB_COLUMNS.updatedAt}, ${DB_COLUMNS.deletedAt}
         FROM sprint_reviews
         WHERE ${DB_COLUMNS.id} = $1 AND ${DB_COLUMNS.deletedAt} IS NULL`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Sprint review not found' });
      }

      return res.json(mapRowToSprintReview(rows[0]));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching sprint review', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/sprint-reviews
  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { weekId, summary, accomplishments, challenges, nextSteps, teamRating } = (req.body || {}) as CreateSprintReviewRequest;

      if (!isValidUUID(weekId)) {
        return res.status(400).json({ error: 'Invalid or missing weekId' });
      }
      if (!summary || typeof summary !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing summary' });
      }
      if (!accomplishments || typeof accomplishments !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing accomplishments' });
      }
      if (!challenges || typeof challenges !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing challenges' });
      }
      if (!nextSteps || typeof nextSteps !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing nextSteps' });
      }
      const rating = Number(teamRating);
      if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
        return res.status(400).json({ error: 'Invalid or missing teamRating' });
      }

      const id = randomUUID();
      const insertSql = `
        INSERT INTO sprint_reviews (
          ${DB_COLUMNS.id}, ${DB_COLUMNS.weekId}, ${DB_COLUMNS.authorId}, ${DB_COLUMNS.summary},
          ${DB_COLUMNS.accomplishments}, ${DB_COLUMNS.challenges}, ${DB_COLUMNS.nextSteps},
          ${DB_COLUMNS.teamRating}, ${DB_COLUMNS.status}
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING ${DB_COLUMNS.id}, ${DB_COLUMNS.weekId}, ${DB_COLUMNS.authorId}, ${DB_COLUMNS.summary},
                  ${DB_COLUMNS.accomplishments}, ${DB_COLUMNS.challenges}, ${DB_COLUMNS.nextSteps},
                  ${DB_COLUMNS.teamRating}, ${DB_COLUMNS.status}, ${DB_COLUMNS.submittedAt},
                  ${DB_COLUMNS.createdAt}, ${DB_COLUMNS.updatedAt}, ${DB_COLUMNS.deletedAt}
      `;

      const params = [
        id,
        String(weekId),
        userId,
        String(summary),
        String(accomplishments),
        String(challenges),
        String(nextSteps),
        rating,
        STATUS_DRAFT,
      ];

      const { rows } = await pool.query(insertSql, params);
      return res.status(201).json(mapRowToSprintReview(rows[0]));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error creating sprint review', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /api/sprint-reviews/:id
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid review id' });
      }

      const { weekId, summary, accomplishments, challenges, nextSteps, teamRating } = (req.body || {}) as Partial<CreateSprintReviewRequest>;

      const sets: string[] = [];
      const params: any[] = [];

      if (typeof weekId !== 'undefined') {
        if (!isValidUUID(String(weekId))) {
          return res.status(400).json({ error: 'Invalid weekId' });
        }
        params.push(String(weekId));
        sets.push(`${DB_COLUMNS.weekId} = $${params.length}`);
      }
      if (typeof summary !== 'undefined') {
        if (typeof summary !== 'string' || !summary) {
          return res.status(400).json({ error: 'Invalid summary' });
        }
        params.push(String(summary));
        sets.push(`${DB_COLUMNS.summary} = $${params.length}`);
      }
      if (typeof accomplishments !== 'undefined') {
        if (typeof accomplishments !== 'string' || !accomplishments) {
          return res.status(400).json({ error: 'Invalid accomplishments' });
        }
        params.push(String(accomplishments));
        sets.push(`${DB_COLUMNS.accomplishments} = $${params.length}`);
      }
      if (typeof challenges !== 'undefined') {
        if (typeof challenges !== 'string' || !challenges) {
          return res.status(400).json({ error: 'Invalid challenges' });
        }
        params.push(String(challenges));
        sets.push(`${DB_COLUMNS.challenges} = $${params.length}`);
      }
      if (typeof nextSteps !== 'undefined') {
        if (typeof nextSteps !== 'string' || !nextSteps) {
          return res.status(400).json({ error: 'Invalid nextSteps' });
        }
        params.push(String(nextSteps));
        sets.push(`${DB_COLUMNS.nextSteps} = $${params.length}`);
      }
      if (typeof teamRating !== 'undefined') {
        const rating = Number(teamRating);
        if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
          return res.status(400).json({ error: 'Invalid teamRating' });
        }
        params.push(rating);
        sets.push(`${DB_COLUMNS.teamRating} = $${params.length}`);
      }

      if (sets.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // updated_at timestamp
      sets.push(`${DB_COLUMNS.updatedAt} = NOW()`);

      params.push(id);
      const sql = `
        UPDATE sprint_reviews
        SET ${sets.join(', ')}
        WHERE ${DB_COLUMNS.id} = $${params.length} AND ${DB_COLUMNS.deletedAt} IS NULL
        RETURNING ${DB_COLUMNS.id}, ${DB_COLUMNS.weekId}, ${DB_COLUMNS.authorId}, ${DB_COLUMNS.summary},
                  ${DB_COLUMNS.accomplishments}, ${DB_COLUMNS.challenges}, ${DB_COLUMNS.nextSteps},
                  ${DB_COLUMNS.teamRating}, ${DB_COLUMNS.status}, ${DB_COLUMNS.submittedAt},
                  ${DB_COLUMNS.createdAt}, ${DB_COLUMNS.updatedAt}, ${DB_COLUMNS.deletedAt}
      `;

      const { rows } = await pool.query(sql, params);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Sprint review not found' });
      }
      return res.json(mapRowToSprintReview(rows[0]));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error updating sprint review', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PATCH /api/sprint-reviews/:id/submit
  router.patch('/:id/submit', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid review id' });
      }

      const { rows } = await pool.query(
        `UPDATE sprint_reviews
         SET ${DB_COLUMNS.status} = $2, ${DB_COLUMNS.submittedAt} = COALESCE(${DB_COLUMNS.submittedAt}, NOW()), ${DB_COLUMNS.updatedAt} = NOW()
         WHERE ${DB_COLUMNS.id} = $1 AND ${DB_COLUMNS.deletedAt} IS NULL
         RETURNING ${DB_COLUMNS.id}, ${DB_COLUMNS.weekId}, ${DB_COLUMNS.authorId}, ${DB_COLUMNS.summary},
                   ${DB_COLUMNS.accomplishments}, ${DB_COLUMNS.challenges}, ${DB_COLUMNS.nextSteps},
                   ${DB_COLUMNS.teamRating}, ${DB_COLUMNS.status}, ${DB_COLUMNS.submittedAt},
                   ${DB_COLUMNS.createdAt}, ${DB_COLUMNS.updatedAt}, ${DB_COLUMNS.deletedAt}`,
        [id, STATUS_SUBMITTED]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Sprint review not found' });
      }
      return res.json(mapRowToSprintReview(rows[0]));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error submitting sprint review', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/sprint-reviews/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid review id' });
      }

      const { rowCount } = await pool.query(
        `UPDATE sprint_reviews SET ${DB_COLUMNS.deletedAt} = NOW() WHERE ${DB_COLUMNS.id} = $1 AND ${DB_COLUMNS.deletedAt} IS NULL`,
        [id]
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Sprint review not found' });
      }

      return res.status(200).json({});
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error deleting sprint review', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
