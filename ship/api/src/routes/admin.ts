import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import { createAuthMiddleware, createRoleMiddleware } from "../middleware/auth.js";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===

// 1. Enum values / constants
const ALLOWED_ROLES = ["member", "admin"] as const;

// 2. Field names / database columns
// Database columns (snake_case)
const DB_COLUMNS = {
  id: "id",
  username: "username",
  email: "email",
  role: "role",
  title: "title",
  department: "department",
  created_at: "created_at",
  deleted_at: "deleted_at",
  updated_at: "updated_at"
} as const;

// TypeScript property names (camelCase)
interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  title: string | null;
  department: string | null;
  createdAt: string;
  deletedAt: string | null;
  updatedAt: string | null;
}

// 3. API endpoints
// Method: GET
// Path: /api/admin/users
// Response: User[]

interface GetUsersResponse {
  users: User[];
}

// Method: PATCH
// Path: /api/admin/users/:id/role
// Request Body: { role: "member" | "admin" }
// Response: User

interface UpdateUserRoleRequest {
  role: typeof ALLOWED_ROLES[number];
}

interface UpdateUserRoleResponse {
  user: User;
}

// Method: DELETE
// Path: /api/admin/users/:id
// Response: 200 OK

// 4. Function signatures
// Backend
export function createAdminRouter(pool: pg.Pool): Router {
  const router = Router();

  const auth = createAuthMiddleware(pool);
  const requireAdmin = createRoleMiddleware(["admin"]);

  type UserRow = {
    id: string;
    username: string;
    email: string;
    role: string;
    title: string | null;
    department: string | null;
    created_at: string | Date;
    updated_at: string | Date | null;
    deleted_at: string | Date | null;
  };

  function mapUser(row: UserRow): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      title: row.title ?? null,
      department: row.department ?? null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    };
  }

  // GET /api/admin/users - list users (admin only)
  router.get("/users", auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Users table may not have deleted_at; alias NULL for consistency
      const result = await pool.query<UserRow>(
        `SELECT ${DB_COLUMNS.id}, ${DB_COLUMNS.username}, ${DB_COLUMNS.email}, ${DB_COLUMNS.role}, ${DB_COLUMNS.title}, ${DB_COLUMNS.department}, ${DB_COLUMNS.created_at}, ${DB_COLUMNS.updated_at}, NULL::timestamptz AS ${DB_COLUMNS.deleted_at}
         FROM users
         ORDER BY ${DB_COLUMNS.created_at} DESC`
      );
      const users = result.rows.map(mapUser);
      const body: GetUsersResponse = { users };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/admin/users/:id/role - update user role (admin only)
  router.patch("/users/:id/role", auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { role } = req.body as UpdateUserRoleRequest;

      if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
        return res.status(400).json({ error: true, message: "Invalid role", status: 400 });
      }

      const result = await pool.query<UserRow>(
        `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1
         RETURNING ${DB_COLUMNS.id}, ${DB_COLUMNS.username}, ${DB_COLUMNS.email}, ${DB_COLUMNS.role}, ${DB_COLUMNS.title}, ${DB_COLUMNS.department}, ${DB_COLUMNS.created_at}, ${DB_COLUMNS.updated_at}, NULL::timestamptz AS ${DB_COLUMNS.deleted_at}`,
        [id, role]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: true, message: "User not found", status: 404 });
      }

      const user = mapUser(result.rows[0]);
      const body: UpdateUserRoleResponse = { user };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/admin/users/:id - deactivate/delete user (admin only)
  router.delete("/users/:id", auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      // Perform hard delete; sessions have ON DELETE CASCADE
      const result = await pool.query("DELETE FROM users WHERE id = $1", [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: true, message: "User not found", status: 404 });
      }

      return res.status(200).json({});
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// Frontend API client (declared in shared contract, not implemented here)
// export function getAdminUsers(): Promise<User[]> {}
// export function updateUserRole(id: string, role: string): Promise<User> {}
// export function deactivateUser(id: string): Promise<void> {}
