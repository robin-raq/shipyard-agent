import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";

export function createDashboardRouter(pool: pg.Pool): Router {
  const router = Router();

  /**
   * GET /api/dashboard/my-work
   * Returns issues that are open or in progress
   * TODO: Filter by assigned user when authentication is implemented
   */
  router.get("/my-work", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = `
        SELECT 
          i.id,
          i.title,
          i.content,
          i.status,
          i.priority,
          i.project_id,
          i.created_at,
          i.updated_at,
          p.title as project_title
        FROM issues i
        LEFT JOIN projects p ON i.project_id = p.id
        WHERE i.deleted_at IS NULL
          AND i.status IN ('open', 'in_progress')
        ORDER BY 
          CASE i.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END,
          i.created_at DESC
      `;

      const result = await pool.query(query);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/dashboard/my-week
   * Returns the current week's data
   * If no current week exists, returns the most recent week
   */
  router.get("/my-week", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = `
        SELECT *
        FROM weeks
        WHERE deleted_at IS NULL
          AND (
            (start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE)
            OR (start_date IS NULL AND end_date IS NULL)
          )
        ORDER BY 
          CASE 
            WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 0
            ELSE 1
          END,
          created_at DESC
        LIMIT 1
      `;

      const result = await pool.query(query);
      
      if (result.rows.length === 0) {
        // If no current week, return the most recent week
        const fallbackQuery = `
          SELECT *
          FROM weeks
          WHERE deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        `;
        const fallbackResult = await pool.query(fallbackQuery);
        
        if (fallbackResult.rows.length === 0) {
          return res.status(200).json(null);
        }
        
        return res.status(200).json(fallbackResult.rows[0]);
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/dashboard/recent-docs
   * Returns the 5 most recently updated documents
   */
  router.get("/recent-docs", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = `
        SELECT 
          id,
          title,
          content,
          created_at,
          updated_at
        FROM docs
        WHERE deleted_at IS NULL
        ORDER BY updated_at DESC
        LIMIT 5
      `;

      const result = await pool.query(query);
      res.status(200).json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/dashboard/summary
   * Returns a summary of all dashboard data in a single request
   * This is more efficient than making 3 separate requests
   */
  router.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Execute all queries in parallel
      const [myWorkResult, myWeekResult, recentDocsResult] = await Promise.all([
        // My Work query
        pool.query(`
          SELECT 
            i.id,
            i.title,
            i.content,
            i.status,
            i.priority,
            i.project_id,
            i.created_at,
            i.updated_at,
            p.title as project_title
          FROM issues i
          LEFT JOIN projects p ON i.project_id = p.id
          WHERE i.deleted_at IS NULL
            AND i.status IN ('open', 'in_progress')
          ORDER BY 
            CASE i.priority
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
            END,
            i.created_at DESC
        `),
        
        // My Week query
        pool.query(`
          SELECT *
          FROM weeks
          WHERE deleted_at IS NULL
            AND (
              (start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE)
              OR (start_date IS NULL AND end_date IS NULL)
            )
          ORDER BY 
            CASE 
              WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 0
              ELSE 1
            END,
            created_at DESC
          LIMIT 1
        `),
        
        // Recent Docs query
        pool.query(`
          SELECT 
            id,
            title,
            content,
            created_at,
            updated_at
          FROM docs
          WHERE deleted_at IS NULL
          ORDER BY updated_at DESC
          LIMIT 5
        `)
      ]);

      // Handle my-week fallback if no current week
      let myWeek = myWeekResult.rows[0] || null;
      if (!myWeek) {
        const fallbackResult = await pool.query(`
          SELECT *
          FROM weeks
          WHERE deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        `);
        myWeek = fallbackResult.rows[0] || null;
      }

      res.status(200).json({
        myWork: myWorkResult.rows,
        myWeek: myWeek,
        recentDocs: recentDocsResult.rows
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
