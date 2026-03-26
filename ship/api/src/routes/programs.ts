import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { keysToCamel } from "../utils/caseTransform.js";

/**
 * @swagger
 * components:
 *   schemas:
 *     Program:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the program
 *         name:
 *           type: string
 *           description: The name of the program
 *         description:
 *           type: string
 *           description: The description of the program
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date the program was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date the program was last updated
 *       example:
 *         id: 1
 *         name: "Engineering Fellowship"
 *         description: "A 12-week intensive program for software engineers"
 *         created_at: "2024-01-01T00:00:00.000Z"
 *         updated_at: "2024-01-01T00:00:00.000Z"
 *     ProgramAssociation:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the association
 *         program_id:
 *           type: integer
 *           description: The id of the program
 *         user_id:
 *           type: integer
 *           description: The id of the user
 *         role:
 *           type: string
 *           enum: [admin, member]
 *           description: The role of the user in the program
 *       example:
 *         id: 1
 *         program_id: 1
 *         user_id: 1
 *         role: "admin"
 */

export function createProgramsRouter(pool: pg.Pool): Router {
  const router = Router();

  /**
   * @swagger
   * /api/programs:
   *   get:
   *     summary: Retrieve a list of programs
   *     tags: [Programs]
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term to filter programs by name or description
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *         description: Maximum number of programs to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *         description: Number of programs to skip
   *     responses:
   *       200:
   *         description: A list of programs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 programs:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Program'
   *                 total:
   *                   type: integer
   *                   description: Total number of programs matching the query
   */
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, limit = "50", offset = "0" } = req.query;
      
      let query = "SELECT * FROM programs WHERE 1=1";
      const params: any[] = [];
      let paramCount = 1;

      // Add search filter if provided
      if (search && typeof search === "string") {
        query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
      }

      // Get total count
      const countQuery = query.replace("SELECT *", "SELECT COUNT(*)");
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Add ordering, limit, and offset
      query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await pool.query(query, params);

      res.status(200).json({
        programs: keysToCamel(result.rows),
        total,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}:
   *   get:
   *     summary: Get a program by id
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *     responses:
   *       200:
   *         description: The program details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Program'
   *       404:
   *         description: Program not found
   */
  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        "SELECT * FROM programs WHERE id = $1",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Program not found",
          status: 404,
        });
      }

      res.status(200).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs:
   *   post:
   *     summary: Create a new program
   *     tags: [Programs]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 description: The name of the program
   *               description:
   *                 type: string
   *                 description: The description of the program
   *     responses:
   *       201:
   *         description: The created program
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Program'
   *       400:
   *         description: Invalid input
   */
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({
          error: true,
          message: "Name is required",
          status: 400,
        });
      }

      const result = await pool.query(
        `INSERT INTO programs (name, description)
         VALUES ($1, $2)
         RETURNING *`,
        [name, description || null]
      );

      res.status(201).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}:
   *   put:
   *     summary: Update a program
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: The name of the program
   *               description:
   *                 type: string
   *                 description: The description of the program
   *     responses:
   *       200:
   *         description: The updated program
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Program'
   *       400:
   *         description: No fields to update
   *       404:
   *         description: Program not found
   */
  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        params.push(name);
      }

      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        params.push(description);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: true,
          message: "No fields to update",
          status: 400,
        });
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);

      const result = await pool.query(
        `UPDATE programs
         SET ${updates.join(", ")}
         WHERE id = $${paramCount}
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Program not found",
          status: 404,
        });
      }

      res.status(200).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}:
   *   patch:
   *     summary: Partially update a program
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: The name of the program
   *               description:
   *                 type: string
   *                 description: The description of the program
   *     responses:
   *       200:
   *         description: The updated program
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Program'
   *       400:
   *         description: No fields to update
   *       404:
   *         description: Program not found
   */
  router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        params.push(name);
      }

      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        params.push(description);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: true,
          message: "No fields to update",
          status: 400,
        });
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);

      const result = await pool.query(
        `UPDATE programs
         SET ${updates.join(", ")}
         WHERE id = $${paramCount}
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Program not found",
          status: 404,
        });
      }

      res.status(200).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}:
   *   delete:
   *     summary: Delete a program
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *     responses:
   *       200:
   *         description: The deleted program
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Program'
   *       404:
   *         description: Program not found
   */
  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `DELETE FROM programs
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Program not found",
          status: 404,
        });
      }

      res.status(200).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  // ==================== PROGRAM ASSOCIATIONS ====================

  /**
   * @swagger
   * /api/programs/{id}/associations:
   *   get:
   *     summary: Get all associations for a program
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *     responses:
   *       200:
   *         description: A list of program associations
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/ProgramAssociation'
   *       404:
   *         description: Program not found
   */
  router.get("/:id/associations", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // First check if program exists
      const programCheck = await pool.query(
        "SELECT id FROM programs WHERE id = $1",
        [id]
      );

      if (programCheck.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Program not found",
          status: 404,
        });
      }

      const result = await pool.query(
        "SELECT * FROM program_associations WHERE program_id = $1",
        [id]
      );

      res.status(200).json(keysToCamel(result.rows));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}/associations:
   *   post:
   *     summary: Create a new program association
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user_id
   *               - role
   *             properties:
   *               user_id:
   *                 type: integer
   *                 description: The user id
   *               role:
   *                 type: string
   *                 enum: [admin, member]
   *                 description: The role of the user in the program
   *     responses:
   *       201:
   *         description: The created program association
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProgramAssociation'
   *       400:
   *         description: Invalid input
   *       404:
   *         description: Program not found
   */
  router.post("/:id/associations", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { user_id, role } = req.body;

      if (!user_id || !role) {
        return res.status(400).json({
          error: true,
          message: "user_id and role are required",
          status: 400,
        });
      }

      if (!["admin", "member"].includes(role)) {
        return res.status(400).json({
          error: true,
          message: "role must be either 'admin' or 'member'",
          status: 400,
        });
      }

      // Check if program exists
      const programCheck = await pool.query(
        "SELECT id FROM programs WHERE id = $1",
        [id]
      );

      if (programCheck.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Program not found",
          status: 404,
        });
      }

      const result = await pool.query(
        `INSERT INTO program_associations (program_id, user_id, role)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [id, user_id, role]
      );

      res.status(201).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}/associations/{associationId}:
   *   put:
   *     summary: Update a program association
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *       - in: path
   *         name: associationId
   *         schema:
   *           type: integer
   *         required: true
   *         description: The association id
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               role:
   *                 type: string
   *                 enum: [admin, member]
   *                 description: The role of the user in the program
   *     responses:
   *       200:
   *         description: The updated program association
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProgramAssociation'
   *       400:
   *         description: Invalid input
   *       404:
   *         description: Association not found
   */
  router.put("/:id/associations/:associationId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, associationId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({
          error: true,
          message: "role is required",
          status: 400,
        });
      }

      if (!["admin", "member"].includes(role)) {
        return res.status(400).json({
          error: true,
          message: "role must be either 'admin' or 'member'",
          status: 400,
        });
      }

      const result = await pool.query(
        `UPDATE program_associations
         SET role = $1, updated_at = NOW()
         WHERE id = $2 AND program_id = $3
         RETURNING *`,
        [role, associationId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Association not found",
          status: 404,
        });
      }

      res.status(200).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}/associations/{associationId}:
   *   patch:
   *     summary: Partially update a program association
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *       - in: path
   *         name: associationId
   *         schema:
   *           type: integer
   *         required: true
   *         description: The association id
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               role:
   *                 type: string
   *                 enum: [admin, member]
   *                 description: The role of the user in the program
   *     responses:
   *       200:
   *         description: The updated program association
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProgramAssociation'
   *       400:
   *         description: Invalid input
   *       404:
   *         description: Association not found
   */
  router.patch("/:id/associations/:associationId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, associationId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({
          error: true,
          message: "role is required",
          status: 400,
        });
      }

      if (!["admin", "member"].includes(role)) {
        return res.status(400).json({
          error: true,
          message: "role must be either 'admin' or 'member'",
          status: 400,
        });
      }

      const result = await pool.query(
        `UPDATE program_associations
         SET role = $1, updated_at = NOW()
         WHERE id = $2 AND program_id = $3
         RETURNING *`,
        [role, associationId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Association not found",
          status: 404,
        });
      }

      res.status(200).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}/associations/{associationId}:
   *   delete:
   *     summary: Delete a program association
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *       - in: path
   *         name: associationId
   *         schema:
   *           type: integer
   *         required: true
   *         description: The association id
   *     responses:
   *       200:
   *         description: The deleted program association
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProgramAssociation'
   *       404:
   *         description: Association not found
   */
  router.delete("/:id/associations/:associationId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, associationId } = req.params;

      const result = await pool.query(
        `DELETE FROM program_associations
         WHERE id = $1 AND program_id = $2
         RETURNING *`,
        [associationId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Association not found",
          status: 404,
        });
      }

      res.status(200).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  // ==================== PROGRAM ISSUES ====================

  /**
   * @swagger
   * /api/programs/{id}/issues:
   *   get:
   *     summary: Get all issues for a program
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [open, in_progress, done, closed]
   *         description: Filter by issue status
   *       - in: query
   *         name: priority
   *         schema:
   *           type: string
   *           enum: [low, medium, high, critical]
   *         description: Filter by issue priority
   *     responses:
   *       200:
   *         description: A list of issues for the program
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *       404:
   *         description: Program not found
   */
  router.get("/:id/issues", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, priority } = req.query;

      // First check if program exists
      const programCheck = await pool.query(
        "SELECT id FROM programs WHERE id = $1",
        [id]
      );

      if (programCheck.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Program not found",
          status: 404,
        });
      }

      let query = "SELECT * FROM issues WHERE program_id = $1 AND deleted_at IS NULL";
      const params: any[] = [id];
      let paramCount = 2;

      if (status) {
        query += ` AND status = $${paramCount++}`;
        params.push(status);
      }

      if (priority) {
        query += ` AND priority = $${paramCount++}`;
        params.push(priority);
      }

      query += " ORDER BY created_at DESC";

      const result = await pool.query(query, params);

      res.status(200).json(keysToCamel(result.rows));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}/issues:
   *   post:
   *     summary: Create a new issue for a program
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - title
   *             properties:
   *               title:
   *                 type: string
   *                 description: The title of the issue
   *               content:
   *                 type: string
   *                 description: The content of the issue
   *               status:
   *                 type: string
   *                 enum: [open, in_progress, done, closed]
   *                 description: The status of the issue
   *               priority:
   *                 type: string
   *                 enum: [low, medium, high, critical]
   *                 description: The priority of the issue
   *               project_id:
   *                 type: string
   *                 format: uuid
   *                 description: The project id (optional)
   *     responses:
   *       201:
   *         description: The created issue
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       400:
   *         description: Invalid input
   *       404:
   *         description: Program not found
   */
  router.post("/:id/issues", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { title, content, status, priority, project_id } = req.body;

      if (!title) {
        return res.status(400).json({
          error: true,
          message: "Title is required",
          status: 400,
        });
      }

      // Check if program exists
      const programCheck = await pool.query(
        "SELECT id FROM programs WHERE id = $1",
        [id]
      );

      if (programCheck.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Program not found",
          status: 404,
        });
      }

      const result = await pool.query(
        `INSERT INTO issues (title, content, status, priority, project_id, program_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          title,
          content || "",
          status || "open",
          priority || "medium",
          project_id || null,
          id
        ]
      );

      res.status(201).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}/issues/{issueId}:
   *   patch:
   *     summary: Update an issue in a program
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *       - in: path
   *         name: issueId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: The issue id
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               content:
   *                 type: string
   *               status:
   *                 type: string
   *                 enum: [open, in_progress, done, closed]
   *               priority:
   *                 type: string
   *                 enum: [low, medium, high, critical]
   *     responses:
   *       200:
   *         description: The updated issue
   *       400:
   *         description: Invalid input
   *       404:
   *         description: Issue not found
   */
  router.patch("/:id/issues/:issueId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, issueId } = req.params;
      const { title, content, status, priority } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        params.push(title);
      }

      if (content !== undefined) {
        updates.push(`content = $${paramCount++}`);
        params.push(content);
      }

      if (status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        params.push(status);
      }

      if (priority !== undefined) {
        updates.push(`priority = $${paramCount++}`);
        params.push(priority);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: true,
          message: "No fields to update",
          status: 400,
        });
      }

      updates.push(`updated_at = NOW()`);
      params.push(issueId, id);

      const result = await pool.query(
        `UPDATE issues
         SET ${updates.join(", ")}
         WHERE id = $${paramCount} AND program_id = $${paramCount + 1} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Issue not found",
          status: 404,
        });
      }

      res.status(200).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}/issues/{issueId}:
   *   delete:
   *     summary: Delete an issue from a program
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *       - in: path
   *         name: issueId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: The issue id
   *     responses:
   *       200:
   *         description: The deleted issue
   *       404:
   *         description: Issue not found
   */
  router.delete("/:id/issues/:issueId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, issueId } = req.params;

      const result = await pool.query(
        `UPDATE issues
         SET deleted_at = NOW()
         WHERE id = $1 AND program_id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [issueId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Issue not found",
          status: 404,
        });
      }

      res.status(200).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  // ==================== PROGRAM PROJECTS ====================

  /**
   * @swagger
   * /api/programs/{id}/projects:
   *   get:
   *     summary: Get all projects for a program
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [active, completed, archived]
   *         description: Filter by project status
   *     responses:
   *       200:
   *         description: A list of projects for the program
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *       404:
   *         description: Program not found
   */
  router.get("/:id/projects", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.query;

      // First check if program exists
      const programCheck = await pool.query(
        "SELECT id FROM programs WHERE id = $1",
        [id]
      );

      if (programCheck.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Program not found",
          status: 404,
        });
      }

      let query = "SELECT * FROM projects WHERE program_id = $1 AND deleted_at IS NULL";
      const params: any[] = [id];
      let paramCount = 2;

      if (status) {
        query += ` AND status = $${paramCount++}`;
        params.push(status);
      }

      query += " ORDER BY created_at DESC";

      const result = await pool.query(query, params);

      res.status(200).json(keysToCamel(result.rows));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}/projects:
   *   post:
   *     summary: Create a new project for a program
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - title
   *             properties:
   *               title:
   *                 type: string
   *                 description: The title of the project
   *               description:
   *                 type: string
   *                 description: The description of the project
   *               status:
   *                 type: string
   *                 enum: [active, completed, archived]
   *                 description: The status of the project
   *     responses:
   *       201:
   *         description: The created project
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       400:
   *         description: Invalid input
   *       404:
   *         description: Program not found
   */
  router.post("/:id/projects", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { title, description, status } = req.body;

      if (!title) {
        return res.status(400).json({
          error: true,
          message: "Title is required",
          status: 400,
        });
      }

      // Check if program exists
      const programCheck = await pool.query(
        "SELECT id FROM programs WHERE id = $1",
        [id]
      );

      if (programCheck.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Program not found",
          status: 404,
        });
      }

      const result = await pool.query(
        `INSERT INTO projects (title, description, status, program_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [title, description || "", status || "active", id]
      );

      res.status(201).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}/projects/{projectId}:
   *   patch:
   *     summary: Update a project in a program
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *       - in: path
   *         name: projectId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: The project id
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *               status:
   *                 type: string
   *                 enum: [active, completed, archived]
   *     responses:
   *       200:
   *         description: The updated project
   *       400:
   *         description: Invalid input
   *       404:
   *         description: Project not found
   */
  router.patch("/:id/projects/:projectId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, projectId } = req.params;
      const { title, description, status } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        params.push(title);
      }

      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        params.push(description);
      }

      if (status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        params.push(status);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: true,
          message: "No fields to update",
          status: 400,
        });
      }

      updates.push(`updated_at = NOW()`);
      params.push(projectId, id);

      const result = await pool.query(
        `UPDATE projects
         SET ${updates.join(", ")}
         WHERE id = $${paramCount} AND program_id = $${paramCount + 1} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Project not found",
          status: 404,
        });
      }

      res.status(200).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @swagger
   * /api/programs/{id}/projects/{projectId}:
   *   delete:
   *     summary: Delete a project from a program
   *     tags: [Programs]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The program id
   *       - in: path
   *         name: projectId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: The project id
   *     responses:
   *       200:
   *         description: The deleted project
   *       404:
   *         description: Project not found
   */
  router.delete("/:id/projects/:projectId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, projectId } = req.params;

      const result = await pool.query(
        `UPDATE projects
         SET deleted_at = NOW()
         WHERE id = $1 AND program_id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [projectId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Project not found",
          status: 404,
        });
      }

      res.status(200).json(keysToCamel(result.rows[0]));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
