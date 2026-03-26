import { Request, Response, NextFunction } from "express";
import pg from "pg";

// Extend Express Request to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
      };
      sessionId?: string;
    }
  }
}

/**
 * Middleware to authenticate requests using session token
 */
export function createAuthMiddleware(pool: pg.Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get session token from Authorization header or cookie
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.startsWith("Bearer ")
        ? authHeader.substring(7)
        : req.headers["x-session-token"] as string;

      if (!sessionToken) {
        return res.status(401).json({
          error: true,
          message: "Authentication required",
          status: 401,
        });
      }

      // Query session and user information
      const result = await pool.query(
        `SELECT 
          s.session_id,
          s.user_id,
          s.expires_at,
          u.username,
          u.email
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_id = $1`,
        [sessionToken]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: true,
          message: "Invalid session",
          status: 401,
        });
      }

      const session = result.rows[0];

      // Check if session has expired
      if (new Date(session.expires_at) < new Date()) {
        // Delete expired session
        await pool.query("DELETE FROM sessions WHERE session_id = $1", [
          sessionToken,
        ]);

        return res.status(401).json({
          error: true,
          message: "Session expired",
          status: 401,
        });
      }

      // Attach user information to request
      req.user = {
        id: session.user_id,
        username: session.username,
        email: session.email,
      };
      req.sessionId = session.session_id;

      next();
    } catch (error) {
      console.error("Authentication error:", error);
      return res.status(500).json({
        error: true,
        message: "Authentication failed",
        status: 500,
      });
    }
  };
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export function createOptionalAuthMiddleware(pool: pg.Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.startsWith("Bearer ")
        ? authHeader.substring(7)
        : req.headers["x-session-token"] as string;

      if (!sessionToken) {
        return next();
      }

      const result = await pool.query(
        `SELECT 
          s.session_id,
          s.user_id,
          s.expires_at,
          u.username,
          u.email
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_id = $1`,
        [sessionToken]
      );

      if (result.rows.length > 0) {
        const session = result.rows[0];

        if (new Date(session.expires_at) >= new Date()) {
          req.user = {
            id: session.user_id,
            username: session.username,
            email: session.email,
          };
          req.sessionId = session.session_id;
        }
      }

      next();
    } catch (error) {
      console.error("Optional authentication error:", error);
      next();
    }
  };
}
