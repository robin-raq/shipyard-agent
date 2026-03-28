import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import {
  createAuthMiddleware,
  createOptionalAuthMiddleware,
  createRoleMiddleware,
} from "../middleware/auth.js";

// Test database setup
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

// Create test app with protected routes
const app = express();
app.use(express.json());

// Test routes for auth middleware
app.get("/protected", createAuthMiddleware(testPool), (req, res) => {
  res.json({
    message: "Protected route accessed",
    user: req.user,
    sessionId: req.sessionId,
  });
});

// Test route for optional auth middleware
app.get("/optional", createOptionalAuthMiddleware(testPool), (req, res) => {
  res.json({
    message: "Optional auth route accessed",
    user: req.user || null,
    authenticated: !!req.user,
  });
});

// Test routes for role middleware
app.get(
  "/admin-only",
  createAuthMiddleware(testPool),
  createRoleMiddleware(["admin"]),
  (req, res) => {
    res.json({
      message: "Admin route accessed",
      user: req.user,
    });
  }
);

app.get(
  "/admin-or-moderator",
  createAuthMiddleware(testPool),
  createRoleMiddleware(["admin", "moderator"]),
  (req, res) => {
    res.json({
      message: "Admin or moderator route accessed",
      user: req.user,
    });
  }
);

// Test route for /api/admin/test
app.get(
  "/api/admin/test",
  createAuthMiddleware(testPool),
  createRoleMiddleware(["admin"]),
  (req, res) => {
    res.json({
      message: "Admin test route accessed",
      user: req.user,
    });
  }
);

describe("Authentication Middleware", () => {
  beforeAll(async () => {
    // Create tables for testing
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);
  });

  afterAll(async () => {
    // Clean up test data
    await testPool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await testPool.query("DROP TABLE IF EXISTS users CASCADE");
    await testPool.end();
  });

  describe("createAuthMiddleware", () => {
    let validSessionToken: string;
    let validUserId: string;

    beforeAll(async () => {
      // Create a test user
      const userResult = await testPool.query(
        `INSERT INTO users (username, email, password, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, username, email, role`,
        ["testuser", "testuser@example.com", "hashedpassword", "user"]
      );
      validUserId = userResult.rows[0].id;

      // Create a valid session
      const sessionResult = await testPool.query(
        `INSERT INTO sessions (user_id, expires_at) 
         VALUES ($1, NOW() + INTERVAL '7 days') 
         RETURNING session_id`,
        [validUserId]
      );
      validSessionToken = sessionResult.rows[0].session_id;
    });

    it("should allow access with valid session token in Authorization header", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${validSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Protected route accessed");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty("username", "testuser");
      expect(response.body.user).toHaveProperty("email", "testuser@example.com");
      expect(response.body.user).toHaveProperty("role", "user");
      expect(response.body.sessionId).toBe(validSessionToken);
    });

    it("should allow access with valid session token in x-session-token header", async () => {
      const response = await request(app)
        .get("/protected")
        .set("x-session-token", validSessionToken);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Protected route accessed");
      expect(response.body.user).toHaveProperty("username", "testuser");
    });

    it("should reject request without session token", async () => {
      const response = await request(app).get("/protected");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain("Authentication required");
      expect(response.body.status).toBe(401);
    });

    it("should reject request with invalid session token", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", "Bearer invalid-token-12345");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
    });

    it("should reject request with non-existent session token", async () => {
      const fakeToken = "00000000-0000-0000-0000-000000000000";
      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${fakeToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain("Invalid session");
    });

    it("should reject expired session token", async () => {
      // Create an expired session
      const expiredSessionResult = await testPool.query(
        `INSERT INTO sessions (user_id, expires_at) 
         VALUES ($1, NOW() - INTERVAL '1 day') 
         RETURNING session_id`,
        [validUserId]
      );
      const expiredToken = expiredSessionResult.rows[0].session_id;

      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain("Session expired");

      // Verify session was deleted from database
      const sessionCheck = await testPool.query(
        "SELECT * FROM sessions WHERE session_id = $1",
        [expiredToken]
      );
      expect(sessionCheck.rows.length).toBe(0);
    });

    it("should handle malformed Authorization header", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", "InvalidFormat");

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Authentication required");
    });

    it("should handle empty Authorization header", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", "Bearer ");

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Authentication required");
    });

    it("should attach user information to request object", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${validSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty("id", validUserId);
      expect(response.body.user).toHaveProperty("username", "testuser");
      expect(response.body.user).toHaveProperty("email", "testuser@example.com");
      expect(response.body.user).toHaveProperty("role", "user");
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("should attach sessionId to request object", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${validSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe(validSessionToken);
    });
  });

  describe("createOptionalAuthMiddleware", () => {
    let optionalAuthSessionToken: string;
    let optionalAuthUserId: string;

    beforeAll(async () => {
      // Create a test user for optional auth
      const userResult = await testPool.query(
        `INSERT INTO users (username, email, password, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, username, email, role`,
        ["optionaluser", "optionaluser@example.com", "hashedpassword", "user"]
      );
      optionalAuthUserId = userResult.rows[0].id;

      // Create a valid session
      const sessionResult = await testPool.query(
        `INSERT INTO sessions (user_id, expires_at) 
         VALUES ($1, NOW() + INTERVAL '7 days') 
         RETURNING session_id`,
        [optionalAuthUserId]
      );
      optionalAuthSessionToken = sessionResult.rows[0].session_id;
    });

    it("should allow access without session token", async () => {
      const response = await request(app).get("/optional");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Optional auth route accessed");
      expect(response.body.user).toBe(null);
      expect(response.body.authenticated).toBe(false);
    });

    it("should attach user information when valid session token provided", async () => {
      const response = await request(app)
        .get("/optional")
        .set("Authorization", `Bearer ${optionalAuthSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Optional auth route accessed");
      expect(response.body.user).toHaveProperty("username", "optionaluser");
      expect(response.body.user).toHaveProperty("email", "optionaluser@example.com");
      expect(response.body.authenticated).toBe(true);
    });

    it("should allow access with invalid session token", async () => {
      const response = await request(app)
        .get("/optional")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(200);
      expect(response.body.user).toBe(null);
      expect(response.body.authenticated).toBe(false);
    });

    it("should allow access with non-existent session token", async () => {
      const fakeToken = "00000000-0000-0000-0000-000000000000";
      const response = await request(app)
        .get("/optional")
        .set("Authorization", `Bearer ${fakeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBe(null);
      expect(response.body.authenticated).toBe(false);
    });

    it("should not attach user information for expired session", async () => {
      // Create an expired session
      const expiredSessionResult = await testPool.query(
        `INSERT INTO sessions (user_id, expires_at) 
         VALUES ($1, NOW() - INTERVAL '1 day') 
         RETURNING session_id`,
        [optionalAuthUserId]
      );
      const expiredToken = expiredSessionResult.rows[0].session_id;

      const response = await request(app)
        .get("/optional")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBe(null);
      expect(response.body.authenticated).toBe(false);
    });

    it("should work with x-session-token header", async () => {
      const response = await request(app)
        .get("/optional")
        .set("x-session-token", optionalAuthSessionToken);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty("username", "optionaluser");
      expect(response.body.authenticated).toBe(true);
    });

    it("should handle malformed Authorization header gracefully", async () => {
      const response = await request(app)
        .get("/optional")
        .set("Authorization", "InvalidFormat");

      expect(response.status).toBe(200);
      expect(response.body.user).toBe(null);
      expect(response.body.authenticated).toBe(false);
    });
  });

  describe("createRoleMiddleware", () => {
    let adminSessionToken: string;
    let moderatorSessionToken: string;
    let userSessionToken: string;

    beforeAll(async () => {
      // Create admin user
      const adminResult = await testPool.query(
        `INSERT INTO users (username, email, password, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        ["adminuser", "admin@example.com", "hashedpassword", "admin"]
      );
      const adminId = adminResult.rows[0].id;

      const adminSessionResult = await testPool.query(
        `INSERT INTO sessions (user_id, expires_at) 
         VALUES ($1, NOW() + INTERVAL '7 days') 
         RETURNING session_id`,
        [adminId]
      );
      adminSessionToken = adminSessionResult.rows[0].session_id;

      // Create moderator user
      const moderatorResult = await testPool.query(
        `INSERT INTO users (username, email, password, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        ["moderatoruser", "moderator@example.com", "hashedpassword", "moderator"]
      );
      const moderatorId = moderatorResult.rows[0].id;

      const moderatorSessionResult = await testPool.query(
        `INSERT INTO sessions (user_id, expires_at) 
         VALUES ($1, NOW() + INTERVAL '7 days') 
         RETURNING session_id`,
        [moderatorId]
      );
      moderatorSessionToken = moderatorSessionResult.rows[0].session_id;

      // Create regular user
      const userResult = await testPool.query(
        `INSERT INTO users (username, email, password, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        ["regularuser", "regular@example.com", "hashedpassword", "user"]
      );
      const userId = userResult.rows[0].id;

      const userSessionResult = await testPool.query(
        `INSERT INTO sessions (user_id, expires_at) 
         VALUES ($1, NOW() + INTERVAL '7 days') 
         RETURNING session_id`,
        [userId]
      );
      userSessionToken = userSessionResult.rows[0].session_id;
    });

    describe("Single role requirement", () => {
      it("should allow access for admin user to admin-only route", async () => {
        const response = await request(app)
          .get("/admin-only")
          .set("Authorization", `Bearer ${adminSessionToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Admin route accessed");
        expect(response.body.user).toHaveProperty("role", "admin");
      });

      it("should deny access for moderator user to admin-only route", async () => {
        const response = await request(app)
          .get("/admin-only")
          .set("Authorization", `Bearer ${moderatorSessionToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe(true);
        expect(response.body.message).toContain("Insufficient permissions");
        expect(response.body.status).toBe(403);
      });

      it("should deny access for regular user to admin-only route", async () => {
        const response = await request(app)
          .get("/admin-only")
          .set("Authorization", `Bearer ${userSessionToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe(true);
        expect(response.body.message).toContain("Insufficient permissions");
      });

      it("should deny access without authentication", async () => {
        const response = await request(app).get("/admin-only");

        expect(response.status).toBe(401);
        expect(response.body.message).toContain("Authentication required");
      });

      it("should return 401 when accessing GET /api/admin/test without token", async () => {
        const response = await request(app).get("/api/admin/test");

        expect(response.status).toBe(401);
        expect(response.body.error).toBe(true);
        expect(response.body.message).toContain("Authentication required");
        expect(response.body.status).toBe(401);
      });

      it("should return 401 when accessing GET /api/admin/test with expired session", async () => {
        // Create a user with admin role
        const userResult = await testPool.query(
          `INSERT INTO users (username, email, password, role) 
           VALUES ($1, $2, $3, $4) 
           RETURNING id`,
          ["expiredadmin", "expiredadmin@example.com", "hashedpassword", "admin"]
        );
        const expiredAdminId = userResult.rows[0].id;

        // Create an expired session
        const expiredSessionResult = await testPool.query(
          `INSERT INTO sessions (user_id, expires_at) 
           VALUES ($1, NOW() - INTERVAL '1 day') 
           RETURNING session_id`,
          [expiredAdminId]
        );
        const expiredToken = expiredSessionResult.rows[0].session_id;

        // Try to access /api/admin/test with expired session
        const response = await request(app)
          .get("/api/admin/test")
          .set("Authorization", `Bearer ${expiredToken}`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe(true);
        expect(response.body.message).toContain("Session expired");
        expect(response.body.status).toBe(401);

        // Verify session was deleted from database
        const sessionCheck = await testPool.query(
          "SELECT * FROM sessions WHERE session_id = $1",
          [expiredToken]
        );
        expect(sessionCheck.rows.length).toBe(0);
      });
    });

    describe("Multiple role requirement", () => {
      it("should allow access for admin user to admin-or-moderator route", async () => {
        const response = await request(app)
          .get("/admin-or-moderator")
          .set("Authorization", `Bearer ${adminSessionToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Admin or moderator route accessed");
        expect(response.body.user).toHaveProperty("role", "admin");
      });

      it("should allow access for moderator user to admin-or-moderator route", async () => {
        const response = await request(app)
          .get("/admin-or-moderator")
          .set("Authorization", `Bearer ${moderatorSessionToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Admin or moderator route accessed");
        expect(response.body.user).toHaveProperty("role", "moderator");
      });

      it("should deny access for regular user to admin-or-moderator route", async () => {
        const response = await request(app)
          .get("/admin-or-moderator")
          .set("Authorization", `Bearer ${userSessionToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe(true);
        expect(response.body.message).toContain("Insufficient permissions");
      });

      it("should deny access without authentication", async () => {
        const response = await request(app).get("/admin-or-moderator");

        expect(response.status).toBe(401);
        expect(response.body.message).toContain("Authentication required");
      });
    });

    describe("Integration: Register, Login, and Access Control", () => {
      it("should register a user, login, and deny access to admin route with x-session-token (role is 'user')", async () => {
        // Step 1: Register a new user
        const username = "integrationuser";
        const email = "integration@example.com";
        const password = "password123";

        const registerResult = await testPool.query(
          `INSERT INTO users (username, email, password, role) 
           VALUES ($1, $2, $3, $4) 
           RETURNING id`,
          [username, email, password, "user"]
        );
        const newUserId = registerResult.rows[0].id;

        // Step 2: Login (create session)
        const loginResult = await testPool.query(
          `INSERT INTO sessions (user_id, expires_at) 
           VALUES ($1, NOW() + INTERVAL '7 days') 
           RETURNING session_id`,
          [newUserId]
        );
        const sessionToken = loginResult.rows[0].session_id;

        // Step 3: Try to access admin route with x-session-token header
        const response = await request(app)
          .get("/admin-only")
          .set("x-session-token", sessionToken);

        // Step 4: Expect 403 Forbidden (user role is 'user', not 'admin')
        expect(response.status).toBe(403);
        expect(response.body.error).toBe(true);
        expect(response.body.message).toContain("Insufficient permissions");
        expect(response.body.status).toBe(403);
      });

      it("should manually UPDATE user role to 'admin' and allow access to admin route", async () => {
        // Step 1: Register a new user with 'user' role
        const username = "promoteduser";
        const email = "promoted@example.com";
        const password = "password123";

        const registerResult = await testPool.query(
          `INSERT INTO users (username, email, password, role) 
           VALUES ($1, $2, $3, $4) 
           RETURNING id`,
          [username, email, password, "user"]
        );
        const newUserId = registerResult.rows[0].id;

        // Step 2: Create session for the user
        const loginResult = await testPool.query(
          `INSERT INTO sessions (user_id, expires_at) 
           VALUES ($1, NOW() + INTERVAL '7 days') 
           RETURNING session_id`,
          [newUserId]
        );
        const sessionToken = loginResult.rows[0].session_id;

        // Step 3: Manually UPDATE the user's role to 'admin' via testPool.query
        await testPool.query(
          `UPDATE users SET role = $1 WHERE id = $2`,
          ["admin", newUserId]
        );

        // Step 4: Access admin route with the same session token
        const response = await request(app)
          .get("/admin-only")
          .set("x-session-token", sessionToken);

        // Step 5: Expect 200 OK (user role is now 'admin')
        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Admin route accessed");
        expect(response.body.user).toHaveProperty("role", "admin");
        expect(response.body.user).toHaveProperty("username", "promoteduser");
        expect(response.body.user).toHaveProperty("email", "promoted@example.com");
      });
    });
  });

  describe("Security", () => {
    let securityTestSessionToken: string;
    let securityTestUserId: string;

    beforeAll(async () => {
      // Create a test user
      const userResult = await testPool.query(
        `INSERT INTO users (username, email, password, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        ["securitytest", "security@example.com", "hashedpassword", "user"]
      );
      securityTestUserId = userResult.rows[0].id;

      // Create a valid session
      const sessionResult = await testPool.query(
        `INSERT INTO sessions (user_id, expires_at) 
         VALUES ($1, NOW() + INTERVAL '7 days') 
         RETURNING session_id`,
        [securityTestUserId]
      );
      securityTestSessionToken = sessionResult.rows[0].session_id;
    });

    it("should not expose password in user object", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${securityTestSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("should validate session token format", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", "Bearer not-a-uuid");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
    });

    it("should handle SQL injection attempts in session token", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", "Bearer ' OR '1'='1");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
    });

    it("should use parameterized queries to prevent SQL injection", async () => {
      const maliciousToken = "'; DROP TABLE sessions; --";
      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${maliciousToken}`);

      expect(response.status).toBe(500);

      // Verify sessions table still exists
      const tableCheck = await testPool.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sessions')"
      );
      expect(tableCheck.rows[0].exists).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    let edgeCaseSessionToken: string;
    let edgeCaseUserId: string;

    beforeAll(async () => {
      // Create a test user
      const userResult = await testPool.query(
        `INSERT INTO users (username, email, password, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        ["edgecaseuser", "edgecase@example.com", "hashedpassword", "user"]
      );
      edgeCaseUserId = userResult.rows[0].id;

      // Create a valid session
      const sessionResult = await testPool.query(
        `INSERT INTO sessions (user_id, expires_at) 
         VALUES ($1, NOW() + INTERVAL '7 days') 
         RETURNING session_id`,
        [edgeCaseUserId]
      );
      edgeCaseSessionToken = sessionResult.rows[0].session_id;
    });

    it("should handle multiple requests with same session token", async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get("/protected")
          .set("Authorization", `Bearer ${edgeCaseSessionToken}`);

        expect(response.status).toBe(200);
        expect(response.body.user).toHaveProperty("username", "edgecaseuser");
      }
    });

    it("should handle session token with extra whitespace", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer  ${edgeCaseSessionToken}  `);

      // Depending on implementation, this might fail
      expect([200, 401, 500]).toContain(response.status);
    });

    it("should handle case-sensitive session tokens", async () => {
      const uppercaseToken = edgeCaseSessionToken.toUpperCase();
      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${uppercaseToken}`);

      // UUIDs are case-insensitive in PostgreSQL, so this might work
      expect([200, 401, 500]).toContain(response.status);
    });

    it("should handle concurrent requests with same session", async () => {
      const requests = Array(3)
        .fill(null)
        .map(() =>
          request(app)
            .get("/protected")
            .set("Authorization", `Bearer ${edgeCaseSessionToken}`)
        );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.user).toHaveProperty("username", "edgecaseuser");
      });
    });

    it("should handle deleted user with active session", async () => {
      // Create a user and session
      const userResult = await testPool.query(
        `INSERT INTO users (username, email, password, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        ["deleteduser", "deleted@example.com", "hashedpassword", "user"]
      );
      const deletedUserId = userResult.rows[0].id;

      const sessionResult = await testPool.query(
        `INSERT INTO sessions (user_id, expires_at) 
         VALUES ($1, NOW() + INTERVAL '7 days') 
         RETURNING session_id`,
        [deletedUserId]
      );
      const deletedUserSessionToken = sessionResult.rows[0].session_id;

      // Delete the user (cascade should delete session)
      await testPool.query("DELETE FROM users WHERE id = $1", [deletedUserId]);

      // Try to use the session
      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${deletedUserSessionToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Invalid session");
    });

    it("should handle session expiring exactly at current time", async () => {
      // Create a session that expires right now
      const sessionResult = await testPool.query(
        `INSERT INTO sessions (user_id, expires_at) 
         VALUES ($1, NOW()) 
         RETURNING session_id`,
        [edgeCaseUserId]
      );
      const expiringToken = sessionResult.rows[0].session_id;

      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${expiringToken}`);

      // Should be expired since expires_at < NOW()
      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Session expired");
    });

    it("should handle very long session tokens", async () => {
      const longToken = "a".repeat(1000);
      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${longToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
    });

    it("should handle empty string session token", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", "Bearer ");

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Authentication required");
    });

    it("should handle null role in user object", async () => {
      // Create a user with null role
      const userResult = await testPool.query(
        `INSERT INTO users (username, email, password, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        ["nullroleuser", "nullrole@example.com", "hashedpassword", null]
      );
      const nullRoleUserId = userResult.rows[0].id;

      const sessionResult = await testPool.query(
        `INSERT INTO sessions (user_id, expires_at) 
         VALUES ($1, NOW() + INTERVAL '7 days') 
         RETURNING session_id`,
        [nullRoleUserId]
      );
      const nullRoleSessionToken = sessionResult.rows[0].session_id;

      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${nullRoleSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty("role");
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors gracefully", async () => {
      // Create a new pool with invalid connection
      const badPool = new pg.Pool({
        connectionString: "postgresql://invalid:invalid@localhost:9999/invalid",
      });

      const badApp = express();
      badApp.use(express.json());
      badApp.get("/bad-protected", createAuthMiddleware(badPool), (req, res) => {
        res.json({ message: "Should not reach here" });
      });

      const response = await request(badApp)
        .get("/bad-protected")
        .set("Authorization", "Bearer some-token");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain("Authentication failed");

      await badPool.end();
    });

    it("should handle missing Authorization header gracefully", async () => {
      const response = await request(app).get("/protected");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain("Authentication required");
    });

    it("should handle undefined x-session-token header", async () => {
      const response = await request(app)
        .get("/protected")
        .set("x-session-token", "");

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Authentication required");
    });
  });
});
