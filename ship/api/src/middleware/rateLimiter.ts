import type * as Express from "express";
import type { Request, Response, NextFunction } from "express";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===

// 1. Enum values / constants
export const MAX_REQUESTS_DEFAULT = 100;
export const WINDOW_MS_DEFAULT = 60000; // 60 seconds
export const AUTH_MAX_REQUESTS = 20;
export const AUTH_WINDOW_MS = 60000; // 60 seconds
export const STATUS_TOO_MANY_REQUESTS = 429;
export const ERROR_TOO_MANY_REQUESTS = "Too many requests";

// 5. TypeScript interfaces
export interface RateLimitResponse {
  error: string;
  retryAfter: number; // seconds
}

/**
 * In-memory sliding window rate limiter.
 * - Tracks request timestamps per key (default key: req.ip)
 * - Prunes entries outside the window on each request
 * - Returns 429 with { error, retryAfter } when limit exceeded
 */
export function createRateLimiter(
  maxRequests: number = MAX_REQUESTS_DEFAULT,
  windowMs: number = WINDOW_MS_DEFAULT
): Express.RequestHandler {
  // Store: key -> ordered array of timestamps (ms)
  const store: Map<string, number[]> = new Map();

  function getKey(req: Request): string {
    // Rely on Express' req.ip which respects trust proxy settings if configured
    return req.ip || "unknown";
  }

  function pruneNow(list: number[], now: number): number[] {
    const boundary = now - windowMs;
    // Find first index within window to avoid O(n) splices in common case
    let startIdx = 0;
    while (startIdx < list.length && list[startIdx] <= boundary) {
      startIdx++;
    }
    if (startIdx === 0) return list; // nothing to prune
    if (startIdx >= list.length) return [];
    return list.slice(startIdx);
  }

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const key = getKey(req);

    const existing = store.get(key) || [];
    const pruned = pruneNow(existing, now);

    // Save back pruned list to avoid unbounded growth
    store.set(key, pruned);

    if (pruned.length >= maxRequests) {
      // Calculate retryAfter (seconds) until next slot opens
      const oldest = pruned[0];
      const retryMs = Math.max(0, oldest + windowMs - now);
      const retryAfter = Math.ceil(retryMs / 1000);

      res.setHeader("Retry-After", String(retryAfter));
      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader("X-RateLimit-Remaining", "0");
      const body: RateLimitResponse = {
        error: ERROR_TOO_MANY_REQUESTS,
        retryAfter,
      };
      return res.status(STATUS_TOO_MANY_REQUESTS).json(body);
    }

    // Record this request and continue
    pruned.push(now);
    store.set(key, pruned);

    const remaining = Math.max(0, maxRequests - pruned.length);
    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(remaining));

    next();
  };
}

// Preconfigured limiter for auth endpoints (e.g., /api/auth)
export const authRateLimiter: Express.RequestHandler = createRateLimiter(
  AUTH_MAX_REQUESTS,
  AUTH_WINDOW_MS
);
