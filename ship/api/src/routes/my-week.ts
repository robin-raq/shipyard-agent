import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware } from "../middleware/auth.js";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===
const STATUS_DRAFT = "draft";
const STATUS_SUBMITTED = "submitted";
const STATUS_APPROVED = "approved";

const STANDUP_USER_ID = "user_id";
const STANDUP_DATE = "standup_date";

const WEEKLY_PLAN_USER_ID = "user_id";
const WEEKLY_PLAN_WEEK_ID = "week_id";
const WEEKLY_PLAN_CONTENT = "plan_content";
const WEEKLY_PLAN_STATUS = "status";

const WEEKLY_RETRO_USER_ID = "user_id";
const WEEKLY_RETRO_WEEK_ID = "week_id";
const WEEKLY_RETRO_WENT_WELL = "went_well";
const WEEKLY_RETRO_TO_IMPROVE = "to_improve";
const WEEKLY_RETRO_ACTION_ITEMS = "action_items";

const WEEK_START_DATE = "start_date";

export function createMyWeekRouter(pool: pg.Pool): Router {
  const router = Router();
  const auth = createAuthMiddleware(pool);

  // Require authentication for all endpoints in this router
  router.use(auth);

  // GET / - fetch current user's week summary
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const weekId = req.query.week_id as string | undefined;
      const userId = req.user!.id;

      // 1) Resolve the week record
      let weekRow: any | null = null;
      if (weekId) {
        const w = await pool.query(
          `SELECT * FROM weeks WHERE id = $1 AND deleted_at IS NULL`,
          [weekId]
        );
        weekRow = w.rows[0] || null;
      } else {
        // Find the week that contains today (by start_date/end_date)
        const w = await pool.query(
          `SELECT *
           FROM weeks
           WHERE deleted_at IS NULL
             AND ${WEEK_START_DATE} IS NOT NULL
             AND end_date IS NOT NULL
             AND CURRENT_DATE BETWEEN ${WEEK_START_DATE} AND end_date
           ORDER BY ${WEEK_START_DATE} DESC
           LIMIT 1`
        );
        weekRow = w.rows[0] || null;
      }

      if (!weekRow) {
        return res.status(404).json({ error: true, message: "Week not found", status: 404 });
      }

      const resolvedWeekId = weekRow.id as string;

      // 2) Today's standup for the current user
      const standupResult = await pool.query(
        `SELECT ${STANDUP_USER_ID}, ${STANDUP_DATE}, yesterday, today, blockers
         FROM standups
         WHERE ${STANDUP_USER_ID} = $1 AND ${STANDUP_DATE} = CURRENT_DATE AND deleted_at IS NULL
         LIMIT 1`,
        [userId]
      );
      const standup = standupResult.rows[0] || null;

      // 3) Weekly plan for this week and user
      const planResult = await pool.query(
        `SELECT ${WEEKLY_PLAN_USER_ID}, ${WEEKLY_PLAN_WEEK_ID}, ${WEEKLY_PLAN_CONTENT}, ${WEEKLY_PLAN_STATUS}
         FROM weekly_plans
         WHERE ${WEEKLY_PLAN_USER_ID} = $1 AND ${WEEKLY_PLAN_WEEK_ID} = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [userId, resolvedWeekId]
      );
      const plan = planResult.rows[0] || null;

      // 4) Weekly retro for this week and user
      const retroResult = await pool.query(
        `SELECT ${WEEKLY_RETRO_USER_ID}, ${WEEKLY_RETRO_WEEK_ID}, ${WEEKLY_RETRO_WENT_WELL}, ${WEEKLY_RETRO_TO_IMPROVE}, ${WEEKLY_RETRO_ACTION_ITEMS}
         FROM weekly_retros
         WHERE ${WEEKLY_RETRO_USER_ID} = $1 AND ${WEEKLY_RETRO_WEEK_ID} = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [userId, resolvedWeekId]
      );
      const retro = retroResult.rows[0] || null;

      res.status(200).json({ week: weekRow, standup, plan, retro });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
