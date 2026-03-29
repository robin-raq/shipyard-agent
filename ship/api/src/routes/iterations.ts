import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware } from "../middleware/auth.js";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===
const ITERATION_STATUSES = ['planned', 'active', 'completed'] as const;

// Database columns (snake_case)
const DB_FIELDS = {
  id: 'id',
  name: 'name',
  team_id: 'team_id',
  start_date: 'start_date',
  end_date: 'end_date',
  goal: 'goal',
  status: 'status',
  created_at: 'created_at',
  updated_at: 'updated_at',
  deleted_at: 'deleted_at'
} as const;

// TypeScript property names (camelCase)
interface Iteration {
  id: string;
  name: string;
  teamId: string;
  startDate: string;
  endDate: string;
  goal: string;
  status: typeof ITERATION_STATUSES[number];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface IterationRow {
  id: string;
  name: string;
  team_id: string;
  start_date: string;
  end_date: string;
  goal: string;
  status: typeof ITERATION_STATUSES[number];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapRow(row: IterationRow): Iteration {
  return {
    id: row.id,
    name: row.name,
    teamId: row.team_id,
    startDate: row.start_date,
    endDate: row.end_date,
    goal: row.goal,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function createIterationsRouter(pool: pg.Pool): Router {
  const router = Router();
  const auth = createAuthMiddleware(pool);

  // Apply auth to all routes
  router.use(auth);

  // GET / - list iterations with optional filters team_id, status
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.query.team_id as string | undefined;
      const status = req.query.status as string | undefined;

      const params: any[] = [];
      let paramCount = 1;
      let query = `SELECT * FROM iterations WHERE ${DB_FIELDS.deleted_at} IS NULL`;

      if (teamId) {
        query += ` AND ${DB_FIELDS.team_id} = $${paramCount++}`;
        params.push(teamId);
      }

      if (status) {
        if (!(ITERATION_STATUSES as readonly string[]).includes(status)) {
          return res.status(400).json({ error: true, message: "Invalid status", status: 400 });
        }
        query += ` AND ${DB_FIELDS.status} = $${paramCount++}`;
        params.push(status);
      }

      query += ` ORDER BY ${DB_FIELDS.start_date} DESC NULLS LAST, ${DB_FIELDS.created_at} DESC`;

      const result = await pool.query<IterationRow>(query, params);
      const iterations = result.rows.map(mapRow);
      res.status(200).json({ iterations });
    } catch (err) {
      next(err);
    }
  });

  // GET /current - get the most recently started active iteration
  router.get("/current", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query<IterationRow>(
        `SELECT * FROM iterations
         WHERE ${DB_FIELDS.status} = 'active' AND ${DB_FIELDS.deleted_at} IS NULL
         ORDER BY ${DB_FIELDS.start_date} DESC NULLS LAST, ${DB_FIELDS.created_at} DESC
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: true, message: "No active iteration", status: 404 });
      }

      const iteration = mapRow(result.rows[0]);
      res.status(200).json({ iteration });
    } catch (err) {
      next(err);
    }
  });

  // GET /:id - get iteration by id
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const result = await pool.query<IterationRow>(
        `SELECT * FROM iterations WHERE ${DB_FIELDS.id} = $1 AND ${DB_FIELDS.deleted_at} IS NULL`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Iteration not found", status: 404 });
      }

      const iteration = mapRow(result.rows[0]);
      res.status(200).json({ iteration });
    } catch (err) {
      next(err);
    }
  });

  // POST / - create iteration
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, teamId, startDate, endDate, goal } = req.body as {
        name?: string;
        teamId?: string;
        startDate?: string;
        endDate?: string;
        goal?: string;
      };

      if (!name || !teamId || !startDate || !endDate) {
        return res.status(400).json({ error: true, message: "name, teamId, startDate, and endDate are required", status: 400 });
      }

      const insert = await pool.query<IterationRow>(
        `INSERT INTO iterations (${DB_FIELDS.name}, ${DB_FIELDS.team_id}, ${DB_FIELDS.start_date}, ${DB_FIELDS.end_date}, ${DB_FIELDS.goal}, ${DB_FIELDS.status})
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, teamId, startDate, endDate, goal || "", 'planned']
      );

      const iteration = mapRow(insert.rows[0]);
      res.status(201).json({ iteration });
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id - update iteration
  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { name, teamId, startDate, endDate, goal, status } = req.body as {
        name?: string;
        teamId?: string;
        startDate?: string;
        endDate?: string;
        goal?: string;
        status?: typeof ITERATION_STATUSES[number] | string;
      };

      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (name !== undefined) { updates.push(`${DB_FIELDS.name} = $${idx++}`); params.push(name); }
      if (teamId !== undefined) { updates.push(`${DB_FIELDS.team_id} = $${idx++}`); params.push(teamId); }
      if (startDate !== undefined) { updates.push(`${DB_FIELDS.start_date} = $${idx++}`); params.push(startDate); }
      if (endDate !== undefined) { updates.push(`${DB_FIELDS.end_date} = $${idx++}`); params.push(endDate); }
      if (goal !== undefined) { updates.push(`${DB_FIELDS.goal} = $${idx++}`); params.push(goal); }
      if (status !== undefined) {
        if (!(ITERATION_STATUSES as readonly string[]).includes(status)) {
          return res.status(400).json({ error: true, message: "Invalid status", status: 400 });
        }
        updates.push(`${DB_FIELDS.status} = $${idx++}`); params.push(status);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: true, message: "No fields to update", status: 400 });
      }

      updates.push(`${DB_FIELDS.updated_at} = NOW()`);
      params.push(id);

      const result = await pool.query<IterationRow>(
        `UPDATE iterations SET ${updates.join(", ")} WHERE ${DB_FIELDS.id} = $${idx} AND ${DB_FIELDS.deleted_at} IS NULL RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Iteration not found", status: 404 });
      }

      const iteration = mapRow(result.rows[0]);
      res.status(200).json({ iteration });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /:id/activate - set iteration status to active
  router.patch("/:id/activate", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const result = await pool.query<IterationRow>(
        `UPDATE iterations SET ${DB_FIELDS.status} = 'active', ${DB_FIELDS.updated_at} = NOW()
         WHERE ${DB_FIELDS.id} = $1 AND ${DB_FIELDS.deleted_at} IS NULL
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Iteration not found", status: 404 });
      }

      const iteration = mapRow(result.rows[0]);
      res.status(200).json({ iteration });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /:id/complete - set iteration status to completed
  router.patch("/:id/complete", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const result = await pool.query<IterationRow>(
        `UPDATE iterations SET ${DB_FIELDS.status} = 'completed', ${DB_FIELDS.updated_at} = NOW()
         WHERE ${DB_FIELDS.id} = $1 AND ${DB_FIELDS.deleted_at} IS NULL
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Iteration not found", status: 404 });
      }

      const iteration = mapRow(result.rows[0]);
      res.status(200).json({ iteration });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id - soft delete iteration
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const result = await pool.query(
        `UPDATE iterations SET ${DB_FIELDS.deleted_at} = NOW() WHERE ${DB_FIELDS.id} = $1 AND ${DB_FIELDS.deleted_at} IS NULL`,
        [id]
      );

      if ((result.rowCount || 0) === 0) {
        return res.status(404).json({ error: true, message: "Iteration not found", status: 404 });
      }

      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
