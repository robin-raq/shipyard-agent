import { Router, Request, Response } from "express";
import pg from "pg";
import { createAuthMiddleware } from "../middleware/auth.js";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===
// Backend:
// export function createProfileRouter(pool: pg.Pool): Router;

interface UserProfile {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  phone: string;
  location: string;
  title: string;
  department: string;
  role: string;
  createdAt: string;
}

function mapUserRow(row: any): UserProfile {
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name ?? "",
    bio: row.bio ?? "",
    avatarUrl: row.avatar_url ?? "",
    phone: row.phone ?? "",
    location: row.location ?? "",
    title: row.title ?? "",
    department: row.department ?? "",
    role: row.role,
    createdAt,
  } as UserProfile;
}

export function createProfileRouter(pool: pg.Pool): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(pool);

  // GET /api/profile/ - current user's profile
  router.get("/", authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: true, message: "Authentication required", status: 401 });
      }

      const { rows } = await pool.query(
        `SELECT id, username, email, display_name, bio, avatar_url, phone, location, title, department, role, created_at
         FROM users WHERE id = $1 LIMIT 1`,
        [req.user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: true, message: "User not found", status: 404 });
      }

      return res.json(mapUserRow(rows[0]));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error fetching profile", err);
      return res.status(500).json({ error: true, message: "Internal server error", status: 500 });
    }
  });

  // PUT /api/profile/ - update current user's profile (partial)
  router.put("/", authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: true, message: "Authentication required", status: 401 });
      }

      const body = (req.body ?? {}) as {
        displayName?: string;
        bio?: string;
        avatarUrl?: string;
        phone?: string;
        location?: string;
      };

      // Validate types if provided
      if (body.displayName !== undefined && typeof body.displayName !== "string") {
        return res.status(400).json({ error: true, message: "Invalid displayName", status: 400 });
      }
      if (body.bio !== undefined && typeof body.bio !== "string") {
        return res.status(400).json({ error: true, message: "Invalid bio", status: 400 });
      }
      if (body.avatarUrl !== undefined && typeof body.avatarUrl !== "string") {
        return res.status(400).json({ error: true, message: "Invalid avatarUrl", status: 400 });
      }
      if (body.phone !== undefined && typeof body.phone !== "string") {
        return res.status(400).json({ error: true, message: "Invalid phone", status: 400 });
      }
      if (body.location !== undefined && typeof body.location !== "string") {
        return res.status(400).json({ error: true, message: "Invalid location", status: 400 });
      }

      const sets: string[] = [];
      const params: any[] = [];

      if (body.displayName !== undefined) {
        params.push(body.displayName);
        sets.push(`display_name = $${params.length}`);
      }
      if (body.bio !== undefined) {
        params.push(body.bio);
        sets.push(`bio = $${params.length}`);
      }
      if (body.avatarUrl !== undefined) {
        params.push(body.avatarUrl);
        sets.push(`avatar_url = $${params.length}`);
      }
      if (body.phone !== undefined) {
        params.push(body.phone);
        sets.push(`phone = $${params.length}`);
      }
      if (body.location !== undefined) {
        params.push(body.location);
        sets.push(`location = $${params.length}`);
      }

      if (sets.length === 0) {
        return res.status(400).json({ error: true, message: "No fields to update", status: 400 });
      }

      // Optionally update updated_at for auditing, if column exists
      sets.push(`updated_at = NOW()`);
      params.push(req.user.id);

      const updateSql = `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length}
        RETURNING id, username, email, display_name, bio, avatar_url, phone, location, title, department, role, created_at`;
      const result = await pool.query(updateSql, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: true, message: "User not found", status: 404 });
      }

      return res.json(mapUserRow(result.rows[0]));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error updating profile", err);
      return res.status(500).json({ error: true, message: "Internal server error", status: 500 });
    }
  });

  // GET /api/profile/:id - another user's profile
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      const { rows } = await pool.query(
        `SELECT id, username, email, display_name, bio, avatar_url, phone, location, title, department, role, created_at
         FROM users WHERE id = $1 LIMIT 1`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: true, message: "User not found", status: 404 });
      }

      return res.json(mapUserRow(rows[0]));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error fetching user profile", err);
      return res.status(500).json({ error: true, message: "Internal server error", status: 500 });
    }
  });

  return router;
}
