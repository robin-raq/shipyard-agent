import { Router } from "express";
import pg from "pg";

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Search across documents, issues, and projects
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (case-insensitive)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, document, issue, project]
 *         description: Type of content to search (defaults to 'all')
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Missing or invalid search query
 */

export function createSearchRouter(pool: pg.Pool): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const { q, type = "all" } = req.query;

      // Validate search query
      if (!q || typeof q !== "string" || q.trim().length === 0) {
        return res.status(400).json({ error: "Search query 'q' is required" });
      }

      const searchQuery = q.trim();
      const searchType = typeof type === "string" ? type.toLowerCase() : "all";

      // Validate type parameter
      const validTypes = ["all", "document", "issue", "project"];
      if (!validTypes.includes(searchType)) {
        return res.status(400).json({ 
          error: `Invalid type. Must be one of: ${validTypes.join(", ")}` 
        });
      }

      const results: any[] = [];

      // Search documents (if type is 'all' or 'document')
      if (searchType === "all" || searchType === "document") {
        const docQuery = `
          SELECT 
            id, 
            title, 
            content, 
            created_at, 
            updated_at,
            'document' as type
          FROM docs
          WHERE deleted_at IS NULL
            AND (LOWER(title) LIKE LOWER($1) 
                 OR LOWER(content) LIKE LOWER($1))
          ORDER BY updated_at DESC
          LIMIT 50
        `;
        const docResult = await pool.query(docQuery, [`%${searchQuery}%`]);
        results.push(...docResult.rows);
      }

      // Search issues (if type is 'all' or 'issue')
      if (searchType === "all" || searchType === "issue") {
        const issueQuery = `
          SELECT 
            id, 
            title, 
            content, 
            status,
            priority,
            created_at, 
            updated_at,
            'issue' as type
          FROM issues
          WHERE deleted_at IS NULL
            AND (LOWER(title) LIKE LOWER($1) 
                 OR LOWER(content) LIKE LOWER($1))
          ORDER BY updated_at DESC
          LIMIT 50
        `;
        const issueResult = await pool.query(issueQuery, [`%${searchQuery}%`]);
        results.push(...issueResult.rows);
      }

      // Search projects (if type is 'all' or 'project')
      if (searchType === "all" || searchType === "project") {
        const projectQuery = `
          SELECT 
            id, 
            title, 
            description as content, 
            status,
            created_at, 
            updated_at,
            'project' as type
          FROM projects
          WHERE deleted_at IS NULL
            AND (LOWER(title) LIKE LOWER($1) 
                 OR LOWER(description) LIKE LOWER($1))
          ORDER BY updated_at DESC
          LIMIT 50
        `;
        const projectResult = await pool.query(projectQuery, [`%${searchQuery}%`]);
        results.push(...projectResult.rows);
      }

      // Sort all results by updated_at (most recent first)
      results.sort((a, b) => {
        const dateA = new Date(a.updated_at).getTime();
        const dateB = new Date(b.updated_at).getTime();
        return dateB - dateA;
      });

      res.json({ 
        query: searchQuery,
        type: searchType,
        count: results.length,
        results 
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
