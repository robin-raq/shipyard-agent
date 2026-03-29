import type * as Express from "express";
import pg from "pg";

// === SHARED CONTRACT (ALL WORKERS MUST MATCH EXACTLY) ===
const HTTP_METHODS_TO_LOG = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

// Database: snake_case; TypeScript: camelCase
interface AuditLogDB {
  id: string; // UUID
  user_id: string | null; // UUID
  action: string; // VARCHAR(10)
  resource_type: string; // VARCHAR(50)
  resource_id: string; // VARCHAR(255)
  request_body: object; // JSONB
  ip_address: string; // VARCHAR(45)
  created_at: Date; // TIMESTAMPTZ
}

interface AuditLogEntry {
  id: string;
  userId: string | null;
  username: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  requestBody: object;
  ipAddress: string;
  createdAt: Date;
}

// Utilities
const SENSITIVE_KEYS = new Set([
  "password",
  "current_password",
  "new_password",
  "confirm_password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "token",
  "access_token",
  "refresh_token",
  "session_token",
  "accessToken",
  "refreshToken",
  "sessionToken",
  "authorization",
  "apiKey",
  "client_secret",
  "clientSecret",
  "secret",
]);

function sanitizeValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;

  // Mask buffers and streams
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(val)) {
    return "[buffer omitted]";
  }

  if (typeof val === "string") {
    // Omit long base64 payloads or data URLs
    if (val.startsWith("data:") && val.includes(";base64,")) {
      return "[base64 data omitted]";
    }
    // Truncate overly long strings to avoid bloating the audit table
    const MAX_LEN = 2000;
    return val.length > MAX_LEN ? `${val.slice(0, MAX_LEN)}… [truncated]` : val;
  }

  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }

  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = sanitizeValue(v);
      }
    }
    return out;
  }

  return val;
}

function sanitizeBody(body: any): object {
  try {
    if (!body || typeof body !== "object") return {};
    const sanitized = sanitizeValue(body);
    // Ensure JSON-serializable plain object
    const serialized = JSON.stringify(sanitized);
    // Enforce size limit (100kb)
    const MAX_BYTES = 100 * 1024;
    if (serialized.length > MAX_BYTES) {
      return { note: "payload too large, truncated", approxBytes: serialized.length };
    }
    return JSON.parse(serialized);
  } catch {
    return { note: "unserializable body omitted" };
  }
}

function getClientIp(req: Express.Request): string {
  const xf = (req.headers["x-forwarded-for"] as string | undefined) || "";
  const first = xf.split(",")[0]?.trim();
  const ip = first || req.ip || (req.socket && req.socket.remoteAddress) || "";
  // Normalize IPv6-mapped IPv4
  return ip.startsWith("::ffff:") ? ip.substring(7) : ip;
}

function deriveResourceType(req: Express.Request): string {
  const base = req.baseUrl || ""; // e.g., "/api/documents"
  const idx = base.indexOf("/api/");
  let seg = idx >= 0 ? base.substring(idx + 5) : base;
  if (seg.startsWith("/")) seg = seg.substring(1);
  const first = seg.split("/")[0]?.trim();
  return first || "unknown";
}

function deriveResourceId(req: Express.Request, sanitizedBody: any): string {
  const p = (req.params as any) || {};
  if (p.id) return String(p.id);
  if (sanitizedBody && typeof sanitizedBody === "object" && "id" in sanitizedBody) {
    try { return String((sanitizedBody as any).id); } catch {}
  }
  // Fallback: last segment if looks non-empty
  const url = req.originalUrl || req.url || "";
  const parts = url.split("?")[0].split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return last || "-";
}

export function createAuditLogger(pool: pg.Pool): Express.RequestHandler {
  return (req, res, next) => {
    const method = req.method?.toUpperCase() || "GET";
    if (!(HTTP_METHODS_TO_LOG as readonly string[]).includes(method)) {
      return next();
    }

    // Snapshot and sanitize body at request time
    const sanitizedBody = sanitizeBody((req as any).body);

    // Defer DB write until after response is sent
    res.on("finish", async () => {
      try {
        const action = method;
        const userId = (req as any).user?.id ?? null;
        const resourceType = deriveResourceType(req);
        const resourceId = deriveResourceId(req, sanitizedBody);
        const ipAddress = getClientIp(req).slice(0, 45);

        await pool.query<AuditLogDB>(
          `INSERT INTO audit_log (user_id, action, resource_type, resource_id, request_body, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, action, resourceType, resourceId, sanitizedBody, ipAddress]
        );
      } catch (err: any) {
        // If table missing (e.g., before migrations), ignore gracefully
        if (err && err.code === "42P01") return;
        console.error("Failed to write audit log:", err);
      }
    });

    next();
  };
}
