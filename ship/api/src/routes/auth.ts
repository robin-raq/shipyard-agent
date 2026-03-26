import { Router, Request, Response } from "express";
import pg from "pg";
import {
  hashPassword,
  comparePassword,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  getSessionExpiration,
} from "../utils/auth.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import type {
  RegisterUserDTO,
  LoginUserDTO,
  AuthResponse,
  UserProfile,
} from "@ship/shared";

export function createAuthRouter(pool: pg.Pool): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(pool);

  /**
   * @route POST /api/auth/register
   * @desc Register a new user
   */
  router.post("/register", async (req: Request, res: Response) => {
    try {
      const { username, email, password }: RegisterUserDTO = req.body;

      // Validate input
      if (!username || !email || !password) {
        return res.status(400).json({
          error: true,
          message: "Username, email, and password are required",
          status: 400,
        });
      }

      if (!isValidUsername(username)) {
        return res.status(400).json({
          error: true,
          message:
            "Invalid username. Must be 3-30 characters, alphanumeric and underscores only",
          status: 400,
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({
          error: true,
          message: "Invalid email format",
          status: 400,
        });
      }

      if (!isValidPassword(password)) {
        return res.status(400).json({
          error: true,
          message: "Password must be at least 8 characters long",
          status: 400,
        });
      }

      // Check if username or email already exists
      const existingUser = await pool.query(
        "SELECT id FROM users WHERE username = $1 OR email = $2",
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          error: true,
          message: "Username or email already exists",
          status: 409,
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const userResult = await pool.query(
        `INSERT INTO users (username, email, password)
         VALUES ($1, $2, $3)
         RETURNING id, username, email, created_at, updated_at`,
        [username, email, hashedPassword]
      );

      const user = userResult.rows[0];

      // Create session
      const expiresAt = getSessionExpiration();
      const sessionResult = await pool.query(
        `INSERT INTO sessions (user_id, expires_at)
         VALUES ($1, $2)
         RETURNING session_id, user_id, created_at, expires_at`,
        [user.id, expiresAt]
      );

      const session = sessionResult.rows[0];

      const response: AuthResponse = {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
        session: {
          session_id: session.session_id,
          user_id: session.user_id,
          created_at: session.created_at,
          expires_at: session.expires_at,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        error: true,
        message: "Failed to register user",
        status: 500,
      });
    }
  });

  /**
   * @route POST /api/auth/login
   * @desc Login a user
   */
  router.post("/login", async (req: Request, res: Response) => {
    try {
      const { username, email, password } = req.body;
      const identifier = username || email;

      // Validate input
      if (!identifier || !password) {
        return res.status(400).json({
          error: true,
          message: "Username/email and password are required",
          status: 400,
        });
      }

      // Find user by username or email
      const userResult = await pool.query(
        "SELECT id, username, email, password, created_at, updated_at FROM users WHERE username = $1 OR email = $1",
        [identifier]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          error: true,
          message: "Invalid username or password",
          status: 401,
        });
      }

      const user = userResult.rows[0];

      // Verify password
      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          error: true,
          message: "Invalid username or password",
          status: 401,
        });
      }

      // Create session
      const expiresAt = getSessionExpiration();
      const sessionResult = await pool.query(
        `INSERT INTO sessions (user_id, expires_at)
         VALUES ($1, $2)
         RETURNING session_id, user_id, created_at, expires_at`,
        [user.id, expiresAt]
      );

      const session = sessionResult.rows[0];

      const response: AuthResponse = {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
        session: {
          session_id: session.session_id,
          user_id: session.user_id,
          created_at: session.created_at,
          expires_at: session.expires_at,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        error: true,
        message: "Failed to login",
        status: 500,
      });
    }
  });

  /**
   * @route POST /api/auth/logout
   * @desc Logout a user (delete session)
   */
  router.post("/logout", authMiddleware, async (req: Request, res: Response) => {
    try {
      const sessionId = req.sessionId;

      if (!sessionId) {
        return res.status(400).json({
          error: true,
          message: "No active session",
          status: 400,
        });
      }

      // Delete session
      await pool.query("DELETE FROM sessions WHERE session_id = $1", [
        sessionId,
      ]);

      res.status(200).json({
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        error: true,
        message: "Failed to logout",
        status: 500,
      });
    }
  });

  /**
   * @route GET /api/auth/me
   * @desc Get current user profile
   */
  router.get("/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: true,
          message: "Not authenticated",
          status: 401,
        });
      }

      // Fetch full user profile
      const userResult = await pool.query(
        "SELECT id, username, email, created_at, updated_at FROM users WHERE id = $1",
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "User not found",
          status: 404,
        });
      }

      const user: UserProfile = userResult.rows[0];
      res.status(200).json(user);
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({
        error: true,
        message: "Failed to get user profile",
        status: 500,
      });
    }
  });

  /**
   * @route DELETE /api/auth/sessions
   * @desc Delete all sessions for current user (logout from all devices)
   */
  router.delete(
    "/sessions",
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            error: true,
            message: "Not authenticated",
            status: 401,
          });
        }

        // Delete all sessions for user
        const result = await pool.query(
          "DELETE FROM sessions WHERE user_id = $1",
          [req.user.id]
        );

        res.status(200).json({
          message: "All sessions deleted successfully",
          deletedCount: result.rowCount || 0,
        });
      } catch (error) {
        console.error("Delete sessions error:", error);
        res.status(500).json({
          error: true,
          message: "Failed to delete sessions",
          status: 500,
        });
      }
    }
  );

  return router;
}
