import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware } from "../middleware/auth.js";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===
const ISSUE_STATUSES = ['triage', 'backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'] as const;
const ISSUE_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

type IssueStatus = typeof ISSUE_STATUSES[number];
type IssuePriority = typeof ISSUE_PRIORITIES[number];

export interface StatusOverview {
  issuesByStatus: Record<IssueStatus, number>;
  issuesByPriority: Record<IssuePriority, number>;
  projectCount: number;
  teamCount: number;
  activeUsersToday: number;
  pendingReviews: number;
}

export function createStatusOverviewRouter(pool: pg.Pool): Router {
  const router = Router();
  const auth = createAuthMiddleware(pool);
  router.use(auth);

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Initialize result shapes with zeros for all enum values
      const issuesByStatus = ISSUE_STATUSES.reduce((acc, s) => {
        acc[s] = 0;
        return acc;
      }, {} as Record<IssueStatus, number>);

      const issuesByPriority = ISSUE_PRIORITIES.reduce((acc, p) => {
        acc[p] = 0;
        return acc;
      }, {} as Record<IssuePriority, number>);

      const [issuesStatusResult, issuesPriorityResult, projectsResult, teamsResult, activeUsersResult, pendingPlansResult, pendingRetrosResult] = await Promise.all([
        pool.query(`SELECT status, COUNT(*)::int AS count FROM issues WHERE deleted_at IS NULL GROUP BY status`),
        pool.query(`SELECT priority, COUNT(*)::int AS count FROM issues WHERE deleted_at IS NULL GROUP BY priority`),
        pool.query(`SELECT COUNT(*)::int AS count FROM projects WHERE deleted_at IS NULL`),
        pool.query(`SELECT COUNT(*)::int AS count FROM teams WHERE deleted_at IS NULL`),
        pool.query(`SELECT COUNT(DISTINCT user_id)::int AS count FROM standups WHERE deleted_at IS NULL AND standup_date = CURRENT_DATE`),
        pool.query(`SELECT COUNT(*)::int AS count FROM weekly_plans WHERE deleted_at IS NULL AND status = 'submitted'`),
        pool.query(`SELECT COUNT(*)::int AS count FROM weekly_retros WHERE deleted_at IS NULL AND status = 'submitted'`),
      ]);

      for (const row of issuesStatusResult.rows) {
        const status = row.status as IssueStatus;
        if (ISSUE_STATUSES.includes(status)) {
          issuesByStatus[status] = row.count as number;
        }
      }

      for (const row of issuesPriorityResult.rows) {
        const priority = row.priority as IssuePriority;
        if (ISSUE_PRIORITIES.includes(priority)) {
          issuesByPriority[priority] = row.count as number;
        }
      }

      const projectCount: number = projectsResult.rows[0]?.count ?? 0;
      const teamCount: number = teamsResult.rows[0]?.count ?? 0;
      const activeUsersToday: number = activeUsersResult.rows[0]?.count ?? 0;
      const pendingReviews: number = (pendingPlansResult.rows[0]?.count ?? 0) + (pendingRetrosResult.rows[0]?.count ?? 0);

      const payload: StatusOverview = {
        issuesByStatus,
        issuesByPriority,
        projectCount,
        teamCount,
        activeUsersToday,
        pendingReviews,
      };

      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
