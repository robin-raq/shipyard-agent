import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware, createRoleMiddleware } from "../middleware/auth.js";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===
const HTTP_METHODS_TO_LOG = ['POST', 'PUT', 'PATCH', 'DELETE'] as const; // not used here, but kept to mirror shared context

// Database: snake_case; TypeScript: camelCase
interface AuditLogDB {
  id: string; // UUID
  user_id: string | null; // UUID
  action: string; // VARCHAR(10)
  resource_type: string; // VARCHAR(50)
  resource_id: string; // VARCHAR(255)
  request_body: object; // JSONB
  ip_address: string; // VARCHAR(45)
  created_at: Date; // TIMESTAMPTZ
}

interface AuditLogEntry {
  id: string;
  userId: string | null;
  username: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  requestBody: object;
  ipAddress: string;
  createdAt: Date;
}

interface GetAuditLogRequest {
  limit?: number;
  offset?: number;
  userId?: string;
  resourceType?: string;
  fromDate?: string;
  toDate?: string;
}

interface GetAuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
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

function mapRowToEntry(row: any): AuditLogEntry {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    username: row.username ?? null,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    requestBody: row.request_body ?? {},
    ipAddress: row.ip_address,
    createdAt: new Date(row.created_at),
  };
}

export function createAuditLogRouter(pool: pg.Pool): Router {
  const router = Router();

  const auth = createAuthMiddleware(pool);
  const requireAdmin = createRoleMiddleware(["admin"]);

  // GET /api/admin/audit-log
  // Query Params: limit (default 50), offset, user_id, resource_type, from_date, to_date
  router.get("/", auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, offset } = parseLimitOffset(req.query);
      const userId = (req.query.user_id as string | undefined) ?? undefined;
      const resourceType = (req.query.resource_type as string | undefined) ?? undefined;
      const fromDate = (req.query.from_date as string | undefined) ?? undefined;
      const toDate = (req.query.to_date as string | undefined) ?? undefined;

      const where: string[] = [];
      const params: any[] = [];
      let i = 1;

      if (userId) {
        where.push(`al.user_id = $${i++}`);
        params.push(userId);
      }
      if (resourceType) {
        where.push(`al.resource_type = $${i++}`);
        params.push(resourceType);
      }
      if (fromDate) {
        where.push(`al.created_at >= $${i++}`);
        params.push(fromDate);
      }
      if (toDate) {
        where.push(`al.created_at <= $${i++}`);
        params.push(toDate);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      // Total count
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS count FROM audit_log al ${whereSql}`,
        params
      );
      const total: number = countResult.rows[0]?.count ?? 0;

      // Paged list with username join
      const listParams = [...params, limit, offset];
      const listSql = `
        SELECT al.id, al.user_id, u.username, al.action, al.resource_type, al.resource_id, al.request_body, al.ip_address, al.created_at
        FROM audit_log al
        LEFT JOIN users u ON u.id = al.user_id
        ${whereSql}
        ORDER BY al.created_at DESC
        LIMIT $${i++} OFFSET $${i++}
      `;

      const listResult = await pool.query(listSql, listParams);
      const entries: AuditLogEntry[] = listResult.rows.map(mapRowToEntry);

      const body: GetAuditLogResponse = { entries, total };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
