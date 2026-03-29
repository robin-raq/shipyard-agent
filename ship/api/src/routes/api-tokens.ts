import { Router, Request, Response, NextFunction } from "express";
import pg from "pg";
import crypto from "crypto";
import { createAuthMiddleware } from "../middleware/auth.js";

// === SHARED CONTRACT CONSTANTS (must match) ===
const TOKEN_BYTE_SIZE = 32;
const TOKEN_PREFIX_LENGTH = 8;

export function createApiTokensRouter(pool: pg.Pool): Router {
  const router = Router();

  // Require authenticated session for all API token routes
  router.use(createAuthMiddleware(pool));

  // GET / - list API tokens for current user (without tokenHash)
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: true, message: "Authentication required", status: 401 });
      }

      const result = await pool.query(
        `SELECT id, name, token_prefix, last_used_at, expires_at, revoked_at, created_at
         FROM api_tokens
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      const tokens = result.rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        tokenPrefix: row.token_prefix as string,
        lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
        expiresAt: row.expires_at ? new Date(row.expires_at) : null,
        revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
        createdAt: new Date(row.created_at),
      }));

      res.status(200).json({ tokens });
    } catch (err) {
      next(err);
    }
  });

  // POST / - create a new API token for current user
  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: true, message: "Authentication required", status: 401 });
      }

      const { name, expiresInDays } = req.body as { name?: string; expiresInDays?: number };

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: true, message: "Name is required", status: 400 });
      }

      let expiresAt: Date | null = null;
      if (expiresInDays !== undefined) {
        const days = Number(expiresInDays);
        if (!Number.isFinite(days) || days <= 0 || days > 3650) {
          return res.status(400).json({ error: true, message: "expiresInDays must be a positive number up to 3650", status: 400 });
        }
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }

      // Generate token (plaintext) and secure hash + prefix for storage
      const plaintextToken = crypto.randomBytes(TOKEN_BYTE_SIZE).toString("hex");
      const tokenPrefix = plaintextToken.slice(0, TOKEN_PREFIX_LENGTH);
      const tokenHash = crypto.createHash("sha256").update(plaintextToken).digest("hex");

      const insert = await pool.query(
        `INSERT INTO api_tokens (user_id, name, token_hash, token_prefix, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, token_prefix, expires_at`,
        [req.user.id, name.trim(), tokenHash, tokenPrefix, expiresAt]
      );

      const row = insert.rows[0];

      const response = {
        id: row.id as string,
        name: row.name as string,
        token: plaintextToken, // only returned once
        tokenPrefix: row.token_prefix as string,
        expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      };

      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id - revoke a token (soft delete via revoked_at)
  router.delete(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: true, message: "Authentication required", status: 401 });
        }

        const id = req.params.id as string;

        // Revoke only if it belongs to current user
        const update = await pool.query(
          `UPDATE api_tokens
           SET revoked_at = NOW()
           WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
           RETURNING id`,
          [id, req.user.id]
        );

        if (update.rows.length === 0) {
          return res.status(404).json({ error: true, message: "Token not found", status: 404 });
        }

        res.status(200).json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
