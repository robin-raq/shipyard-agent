import express from 'express';
import type { Request, Response, Router } from 'express';
import type pg from 'pg';

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===
// Backend function to create router
export function createOrgChartRouter(pool: pg.Pool): Router {
  const router = express.Router();

  // Auth helpers (copied pattern from other routes)
  function isValidUUID(v?: string): boolean {
    if (!v) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  function getAuthUserId(req: Request): string | undefined {
    const userId: string | undefined = (req as any).user?.id || (req as any).auth?.userId;
    return isValidUUID(userId) ? (userId as string) : undefined;
  }

  function requireAuth(req: Request, res: Response, next: express.NextFunction) {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  }

  router.use(requireAuth);

  // Types for internal mapping
  interface UserNode {
    id: string;
    username: string;
    email: string;
    title: string | null;
    department: string | null;
    reportsTo: string | null;
    children?: UserNode[]; // used in tree response
  }

  function mapUserRow(row: any): UserNode {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      title: row.title ?? null,
      department: row.department ?? null,
      reportsTo: row.reports_to ?? null,
    } as UserNode;
  }

  // GET /api/org-chart
  // Response: { tree: any[], departments: string[] }
  router.get('/', async (_req: Request, res: Response) => {
    try {
      // Pull all users and build a manager->reports tree
      const { rows } = await pool.query(
        'SELECT id, username, email, title, department, reports_to FROM users'
      );

      // Map base users
      const nodesById: Map<string, UserNode> = new Map();
      for (const r of rows) {
        nodesById.set(r.id, mapUserRow(r));
      }

      // Initialize children arrays
      for (const n of nodesById.values()) {
        n.children = [];
      }

      // Attach children to managers
      for (const n of nodesById.values()) {
        const mgrId = n.reportsTo || undefined;
        if (mgrId && nodesById.has(mgrId)) {
          nodesById.get(mgrId)!.children!.push(n);
        }
      }

      // Roots are those without a valid manager in the map
      const tree: UserNode[] = Array.from(nodesById.values()).filter((n) => !n.reportsTo || !nodesById.has(n.reportsTo));

      // Sort by username for stable output (breadth-first not required)
      const sortRec = (list: UserNode[]) => {
        list.sort((a, b) => a.username.localeCompare(b.username));
        for (const c of list) sortRec(c.children || []);
      };
      sortRec(tree);

      // Departments list (distinct, filtered, sorted)
      const depSet = new Set<string>();
      for (const r of rows) {
        const d = (r.department ?? '').trim();
        if (d) depSet.add(d);
      }
      const departments = Array.from(depSet).sort((a, b) => a.localeCompare(b));

      return res.json({ tree, departments });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error building org chart', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/org-chart/user/:id
  // Response: { user: any, manager: any | null, direct_reports: any[] }
  router.get('/user/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid user id' });
      }

      const { rows } = await pool.query(
        'SELECT id, username, email, title, department, reports_to FROM users WHERE id = $1 LIMIT 1',
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = mapUserRow(rows[0]);

      let manager: UserNode | null = null;
      if (user.reportsTo) {
        const mgr = await pool.query(
          'SELECT id, username, email, title, department, reports_to FROM users WHERE id = $1 LIMIT 1',
          [user.reportsTo]
        );
        if (mgr.rows.length > 0) manager = mapUserRow(mgr.rows[0]);
      }

      const drRes = await pool.query(
        'SELECT id, username, email, title, department, reports_to FROM users WHERE reports_to = $1',
        [id]
      );
      const direct_reports = drRes.rows.map(mapUserRow);

      return res.json({ user, manager, direct_reports });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching org user', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /api/org-chart/user/:id
  // Request body: { title?: string, department?: string, reports_to?: string }
  // Response: { user: any }
  router.put('/user/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid user id' });
      }

      const body = (req.body ?? {}) as { title?: string; department?: string; reports_to?: string | null };
      const sets: string[] = [];
      const params: any[] = [];

      if (body.title !== undefined) {
        if (body.title !== null && typeof body.title !== 'string') {
          return res.status(400).json({ error: 'Invalid title' });
        }
        params.push(body.title ?? null);
        sets.push(`title = $${params.length}`);
      }
      if (body.department !== undefined) {
        if (body.department !== null && typeof body.department !== 'string') {
          return res.status(400).json({ error: 'Invalid department' });
        }
        params.push(body.department ?? null);
        sets.push(`department = $${params.length}`);
      }
      if (body.reports_to !== undefined) {
        const mgr = body.reports_to;
        if (mgr === id) {
          return res.status(400).json({ error: 'reports_to cannot be self' });
        }
        if (mgr !== null && mgr !== undefined && !isValidUUID(mgr)) {
          return res.status(400).json({ error: 'Invalid reports_to' });
        }
        params.push(mgr ?? null);
        sets.push(`reports_to = $${params.length}`);
      }

      if (sets.length === 0) {
        // Nothing to update; return current user values if exists
        const cur = await pool.query(
          'SELECT id, username, email, title, department, reports_to FROM users WHERE id = $1 LIMIT 1',
          [id]
        );
        if (cur.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
        return res.json({ user: mapUserRow(cur.rows[0]) });
      }

      params.push(id);
      const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id, username, email, title, department, reports_to`;
      const result = await pool.query(sql, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ user: mapUserRow(result.rows[0]) });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error updating org user', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
