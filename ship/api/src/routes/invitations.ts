import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import crypto from "crypto";
import { hashPassword, isValidEmail, isValidPassword, isValidUsername } from "../utils/auth.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { createRoleMiddleware } from "../middleware/auth.js";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===
const INVITATION_ROLES = ["member", "admin"] as const;
const INVITATION_STATUSES = ["pending", "accepted", "expired", "revoked"] as const;

type InvitationRole = typeof INVITATION_ROLES[number];

type InvitationStatus = typeof INVITATION_STATUSES[number];

interface InvitationDB {
  id: string;
  email: string;
  invited_by: string;
  role: string;
  token: string;
  status: string;
  accepted_at: Date | null;
  expires_at: Date;
  created_at: Date;
}

interface Invitation {
  id: string;
  email: string;
  invitedBy: string;
  role: InvitationRole;
  token: string;
  status: InvitationStatus;
  acceptedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

interface CreateInvitationRequest {
  email: string;
  role: InvitationRole;
}

export function createInvitationsRouter(pool: pg.Pool): Router {
  const router = Router();

  const auth = createAuthMiddleware(pool);
  const requireAdmin = createRoleMiddleware(["admin"]);

  function mapRow(row: InvitationDB): Invitation {
    return {
      id: row.id,
      email: row.email,
      invitedBy: row.invited_by,
      role: row.role as InvitationRole,
      token: row.token,
      status: row.status as InvitationStatus,
      acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    };
  }

  async function ensureNotExpired(invite: InvitationDB): Promise<InvitationDB> {
    if (invite.status === "pending" && new Date(invite.expires_at) < new Date()) {
      // Mark as expired
      await pool.query(
        "UPDATE invitations SET status = 'expired' WHERE id = $1",
        [invite.id]
      );
      return { ...invite, status: "expired" } as InvitationDB;
    }
    return invite;
  }

  // GET /api/invitations - list invitations (admin only)
  router.get("/", auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query<InvitationDB>(
        "SELECT id, email, invited_by, role, token, status, accepted_at, expires_at, created_at FROM invitations ORDER BY created_at DESC"
      );
      const invitations = result.rows.map(mapRow);
      res.status(200).json({ invitations });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/invitations - create invitation (admin only)
  router.post("/", auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, role } = req.body as CreateInvitationRequest;

      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: true, message: "Valid email is required", status: 400 });
      }
      if (!role || !(INVITATION_ROLES as readonly string[]).includes(role)) {
        return res.status(400).json({ error: true, message: "Invalid role", status: 400 });
      }

      // Ensure email not already a user
      const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: true, message: "User with this email already exists", status: 409 });
      }

      // Prevent duplicate pending invitation for same email
      const existingInvite = await pool.query(
        "SELECT id FROM invitations WHERE email = $1 AND status = 'pending' AND expires_at > NOW() LIMIT 1",
        [email]
      );
      if (existingInvite.rows.length > 0) {
        return res.status(409).json({ error: true, message: "An active invitation for this email already exists", status: 409 });
      }

      const token = crypto.randomBytes(32).toString("hex"); // 64 chars
      const invitedBy = req.user?.id as string;
      const insert = await pool.query<InvitationDB>(
        `INSERT INTO invitations (email, invited_by, role, token, status, expires_at)
         VALUES ($1, $2, $3, $4, 'pending', NOW() + INTERVAL '7 days')
         RETURNING id, email, invited_by, role, token, status, accepted_at, expires_at, created_at`,
        [email, invitedBy, role, token]
      );

      res.status(201).json({ invitation: mapRow(insert.rows[0]) });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/invitations/accept/:token - get invitation info by token (public)
  router.get("/accept/:token", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.params.token as string;

      const result = await pool.query<InvitationDB>(
        "SELECT id, email, invited_by, role, token, status, accepted_at, expires_at, created_at FROM invitations WHERE token = $1 LIMIT 1",
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: true, message: "Invitation not found", status: 404 });
      }

      let invite = await ensureNotExpired(result.rows[0]);

      if (invite.status !== "pending") {
        const status = invite.status === "expired" ? 410 : 409;
        return res.status(status).json({ error: true, message: `Invitation ${invite.status}`, status });
      }

      // Only return minimal info per contract
      return res.status(200).json({ email: invite.email, role: invite.role as InvitationRole });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/invitations/accept/:token - accept invitation and create account (public)
  router.post("/accept/:token", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.params.token as string;
      const { username, password } = req.body as { username: string; password: string };

      if (!username || !password) {
        return res.status(400).json({ error: true, message: "Username and password are required", status: 400 });
      }
      if (!isValidUsername(username)) {
        return res.status(400).json({ error: true, message: "Invalid username", status: 400 });
      }
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: true, message: "Password must be at least 8 characters long", status: 400 });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const invRes = await client.query<InvitationDB>(
          "SELECT * FROM invitations WHERE token = $1 FOR UPDATE",
          [token]
        );
        if (invRes.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: true, message: "Invitation not found", status: 404 });
        }

        let invite = await ensureNotExpired(invRes.rows[0]);
        if (invite.status !== "pending") {
          await client.query("ROLLBACK");
          const statusCode = invite.status === "expired" ? 410 : 409;
          return res.status(statusCode).json({ error: true, message: `Invitation ${invite.status}`, status: statusCode });
        }

        // Ensure username and email are not already taken
        const userExists = await client.query(
          "SELECT id FROM users WHERE username = $1 OR email = $2",
          [username, invite.email]
        );
        if (userExists.rows.length > 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: true, message: "Username or email already exists", status: 409 });
        }

        const passwordHash = await hashPassword(password);

        // Create user with invitation role
        const userInsert = await client.query(
          `INSERT INTO users (username, email, password, role)
           VALUES ($1, $2, $3, $4)
           RETURNING id, username, email, role, created_at`,
          [username, invite.email, passwordHash, invite.role]
        );
        const user = userInsert.rows[0];

        // Mark invitation accepted
        await client.query(
          `UPDATE invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
          [invite.id]
        );

        await client.query("COMMIT");

        return res.status(200).json({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            createdAt: new Date(user.created_at),
          },
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/invitations/:id - revoke invitation (admin only)
  router.delete("/:id", auth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      // Only revoke pending invitations
      const result = await pool.query(
        `UPDATE invitations SET status = 'revoked' WHERE id = $1 AND status = 'pending' RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        // Determine if not found or conflict
        const check = await pool.query<InvitationDB>(
          "SELECT status FROM invitations WHERE id = $1",
          [id]
        );
        if (check.rows.length === 0) {
          return res.status(404).json({ error: true, message: "Invitation not found", status: 404 });
        }
        return res.status(409).json({ error: true, message: `Cannot revoke invitation with status ${check.rows[0].status}` , status: 409});
      }

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
