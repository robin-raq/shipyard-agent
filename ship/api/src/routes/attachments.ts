import express from 'express';
import type { Request, Response } from 'express';
import type pg from 'pg';
import { randomUUID } from 'crypto';

// === SHARED CONTRACT (must match frontend) ===
const ENTITY_TYPES = ['issue', 'project', 'document'] as const;

type EntityType = typeof ENTITY_TYPES[number];

interface Attachment {
  id: string;
  entityType: string;
  entityId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  deletedAt: string | null;
}

function mapRowToAttachment(row: any): Attachment {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    filename: row.filename,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    uploadedBy: row.uploaded_by,
    createdAt: (row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at),
    deletedAt: row.deleted_at ? (row.deleted_at instanceof Date ? row.deleted_at.toISOString() : row.deleted_at) : null
  };
}

function isValidUUID(v?: string): boolean {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function createAttachmentsRouter(pool: pg.Pool): express.Router {
  const router = express.Router();

  // GET /api/attachments?entity_type=issue&entity_id=UUID
  router.get('/', async (req: Request, res: Response) => {
    try {
      const entity_type = String(req.query.entity_type || '').trim();
      const entity_id = String(req.query.entity_id || '').trim();

      if (!entity_type || !ENTITY_TYPES.includes(entity_type as EntityType)) {
        return res.status(400).json({ error: 'Invalid or missing entity_type' });
      }
      if (!isValidUUID(entity_id)) {
        return res.status(400).json({ error: 'Invalid or missing entity_id' });
      }

      const { rows } = await pool.query(
        `SELECT id, entity_type, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by, created_at, deleted_at
         FROM attachments
         WHERE entity_type = $1 AND entity_id = $2 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [entity_type, entity_id]
      );

      return res.json(rows.map(mapRowToAttachment));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching attachments', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/attachments
  // Body: { entity_type, entity_id, filename, original_name, mime_type, size_bytes }
  router.post('/', async (req: Request, res: Response) => {
    try {
      const {
        entity_type,
        entity_id,
        filename,
        original_name,
        mime_type,
        size_bytes
      } = req.body || {};

      if (!entity_type || !ENTITY_TYPES.includes(String(entity_type) as EntityType)) {
        return res.status(400).json({ error: 'Invalid or missing entity_type' });
      }
      if (!isValidUUID(entity_id)) {
        return res.status(400).json({ error: 'Invalid or missing entity_id' });
      }
      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing filename' });
      }
      if (!original_name || typeof original_name !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing original_name' });
      }
      if (!mime_type || typeof mime_type !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing mime_type' });
      }
      const sizeNum = Number(size_bytes);
      if (!Number.isFinite(sizeNum) || sizeNum < 0) {
        return res.status(400).json({ error: 'Invalid or missing size_bytes' });
      }

      // Determine uploader from request context (set by auth middleware)
      const userId: string | undefined = (req as any).user?.id || (req as any).auth?.userId;
      if (!isValidUUID(userId)) {
        return res.status(401).json({ error: 'Unauthorized: missing user context' });
      }

      const id = randomUUID();
      const insertQuery = `
        INSERT INTO attachments (
          id, entity_type, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, entity_type, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by, created_at, deleted_at
      `;

      const params = [
        id,
        String(entity_type),
        String(entity_id),
        String(filename),
        String(original_name),
        String(mime_type),
        sizeNum,
        userId
      ];

      const { rows } = await pool.query(insertQuery, params);
      const attachment = mapRowToAttachment(rows[0]);
      return res.status(201).json(attachment);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error creating attachment', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/attachments/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid attachment id' });
      }

      const { rowCount } = await pool.query(
        `UPDATE attachments SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Attachment not found' });
      }

      return res.status(200).json({});
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error deleting attachment', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
