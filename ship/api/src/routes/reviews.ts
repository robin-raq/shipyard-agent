import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware } from "../middleware/auth.js";

const VALID_ENTITY_TYPES = ["weekly_plan", "weekly_retro"];
const VALID_DECISIONS = ["approved", "changes_requested"];

export function createReviewsRouter(pool: pg.Pool): Router {
  const router = Router();
  const auth = createAuthMiddleware(pool);
  router.use(auth);

  // GET / - list reviews with optional filters
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entity_type, entity_id, reviewer_id } = req.query;

      let query = `
        SELECT r.*, u.username AS reviewer_name
        FROM reviews r
        JOIN users u ON r.reviewer_id = u.id
        WHERE 1=1`;
      const params: string[] = [];
      let paramCount = 1;

      if (entity_type) {
        query += ` AND r.entity_type = $${paramCount++}`;
        params.push(entity_type as string);
      }
      if (entity_id) {
        query += ` AND r.entity_id = $${paramCount++}`;
        params.push(entity_id as string);
      }
      if (reviewer_id) {
        query += ` AND r.reviewer_id = $${paramCount++}`;
        params.push(reviewer_id as string);
      }

      query += " ORDER BY r.created_at DESC";

      const result = await pool.query(query, params);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // GET /pending - list plans/retros awaiting review (status = 'submitted')
  router.get("/pending", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await pool.query(`
        SELECT wp.id, wp.user_id, wp.week_id, wp.plan_content, wp.status, wp.submitted_at,
               u.username, 'weekly_plan' AS entity_type
        FROM weekly_plans wp
        JOIN users u ON wp.user_id = u.id
        WHERE wp.status = 'submitted' AND wp.deleted_at IS NULL
        ORDER BY wp.submitted_at ASC
      `);

      const retros = await pool.query(`
        SELECT wr.id, wr.user_id, wr.week_id, wr.went_well, wr.to_improve, wr.action_items,
               wr.status, wr.submitted_at, u.username, 'weekly_retro' AS entity_type
        FROM weekly_retros wr
        JOIN users u ON wr.user_id = u.id
        WHERE wr.status = 'submitted' AND wr.deleted_at IS NULL
        ORDER BY wr.submitted_at ASC
      `);

      res.status(200).json({
        plans: plans.rows,
        retros: retros.rows,
        total: plans.rows.length + retros.rows.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST / - create a review (approve or request changes)
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entity_type, entity_id, decision, comment } = req.body;

      if (!entity_type || !VALID_ENTITY_TYPES.includes(entity_type)) {
        return res.status(400).json({ error: true, message: "Invalid entity_type", status: 400 });
      }
      if (!entity_id) {
        return res.status(400).json({ error: true, message: "entity_id is required", status: 400 });
      }
      if (!decision || !VALID_DECISIONS.includes(decision)) {
        return res.status(400).json({ error: true, message: "Invalid decision", status: 400 });
      }

      // Update the corresponding plan/retro status
      const table = entity_type === "weekly_plan" ? "weekly_plans" : "weekly_retros";
      const newStatus = decision === "approved" ? "approved" : "changes_requested";

      const entityCheck = await pool.query(
        `SELECT id FROM ${table} WHERE id = $1 AND deleted_at IS NULL`,
        [entity_id]
      );
      if (entityCheck.rows.length === 0) {
        return res.status(404).json({ error: true, message: `${entity_type} not found`, status: 404 });
      }

      await pool.query(
        `UPDATE ${table} SET status = $1, updated_at = NOW() WHERE id = $2`,
        [newStatus, entity_id]
      );

      // Create the review record
      const result = await pool.query(
        `INSERT INTO reviews (reviewer_id, entity_type, entity_id, decision, comment)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.user!.id, entity_type, entity_id, decision, comment || ""]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
