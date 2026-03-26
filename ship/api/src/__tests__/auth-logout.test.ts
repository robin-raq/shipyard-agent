import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createAuthRouter } from "../routes/auth.js";

// Test database setup
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter(testPool));

describe("POST /api/auth/logout - Session Clearing", () => {
  beforeAll(async () => {
    // Create tables for testing
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
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

  describe("Successful logout", () => {
    it("should successfully logout and clear the session from database", async () => {
      // Register a user
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "logoutuser1",
          email: "logoutuser1@example.com",
          password: "password123",
        });

      const sessionId = registerResponse.body.session.session_id;
      const userId = registerResponse.body.user.id;

      // Verify session exists in database
      const sessionBefore = await testPool.query(
        "SELECT * FROM sessions WHERE session_id = $1",
        [sessionId]
      );
      expect(sessionBefore.rows.length).toBe(1);
      expect(sessionBefore.rows[0].user_id).toBe(userId);

      // Logout
      const logoutResponse = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toBe("Logged out successfully");

      // Verify session is deleted from database
      const sessionAfter = await testPool.query(
        "SELECT * FROM sessions WHERE session_id = $1",
        [sessionId]
      );
      expect(sessionAfter.rows.length).toBe(0);
    });

    it("should return success message on logout", async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "logoutuser2",
          email: "logoutuser2@example.com",
          password: "password123",
        });

      const sessionId = registerResponse.body.session.session_id;

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("Logged out successfully");
      expect(response.body).not.toHaveProperty("error");
    });

    it("should invalidate session immediately after logout", async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "logoutuser3",
          email: "logoutuser3@example.com",
          password: "password123",
        });

      const sessionId = registerResponse.body.session.session_id;

      // Logout
      await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${sessionId}`);

      // Try to access protected route with the same session
      const meResponse = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(meResponse.status).toBe(401);
      expect(meResponse.body.message).toContain("Invalid session");
    });

    it("should not allow using the same session token after logout", async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "logoutuser4",
          email: "logoutuser4@example.com",
          password: "password123",
        });

      const sessionId = registerResponse.body.session.session_id;

      // Logout
      await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${sessionId}`);

      // Try to logout again with the same token
      const secondLogoutResponse = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(secondLogoutResponse.status).toBe(401);
      expect(secondLogoutResponse.body.message).toContain("Invalid session");
    });
  });

  describe("Multiple sessions handling", () => {
    it("should only clear the current session, not other sessions", async () => {
      // Register a user
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "multisession1",
          email: "multisession1@example.com",
          password: "password123",
        });

      const session1 = registerResponse.body.session.session_id;

      // Create a second session by logging in again
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          username: "multisession1",
          password: "password123",
        });

      const session2 = loginResponse.body.session.session_id;

      // Verify both sessions are different
      expect(session1).not.toBe(session2);

      // Verify both sessions work
      const me1Before = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${session1}`);
      const me2Before = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${session2}`);

      expect(me1Before.status).toBe(200);
      expect(me2Before.status).toBe(200);

      // Logout from session1
      const logoutResponse = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${session1}`);

      expect(logoutResponse.status).toBe(200);

      // Session1 should be invalid
      const me1After = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${session1}`);

      expect(me1After.status).toBe(401);

      // Session2 should still work
      const me2After = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${session2}`);

      expect(me2After.status).toBe(200);
      expect(me2After.body.username).toBe("multisession1");
    });

    it("should clear only the specified session from database", async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "multisession2",
          email: "multisession2@example.com",
          password: "password123",
        });

      const session1 = registerResponse.body.session.session_id;
      const userId = registerResponse.body.user.id;

      // Create second session
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          username: "multisession2",
          password: "password123",
        });

      const session2 = loginResponse.body.session.session_id;

      // Verify both sessions exist in database
      const sessionsBefore = await testPool.query(
        "SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at",
        [userId]
      );
      expect(sessionsBefore.rows.length).toBe(2);

      // Logout from session1
      await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${session1}`);

      // Verify only session1 is deleted
      const sessionsAfter = await testPool.query(
        "SELECT * FROM sessions WHERE user_id = $1",
        [userId]
      );
      expect(sessionsAfter.rows.length).toBe(1);
      expect(sessionsAfter.rows[0].session_id).toBe(session2);
    });
  });

  describe("Authentication requirements", () => {
    it("should require authentication header", async () => {
      const response = await request(app).post("/api/auth/logout");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain("Authentication required");
    });

    it("should reject logout with missing Bearer token", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", "");

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Authentication required");
    });

    it("should reject logout with malformed Authorization header", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", "InvalidFormat token123");

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Authentication required");
    });

    it("should reject logout with invalid session token", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", "Bearer 00000000-0000-0000-0000-000000000000");

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Invalid session");
    });

    it("should reject logout with non-UUID session token", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", "Bearer not-a-valid-uuid");

      // Database will reject invalid UUID format
      expect(response.status).toBe(500);
    });

    it("should reject logout with expired session", async () => {
      // Register a user
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "expiredlogout",
          email: "expiredlogout@example.com",
          password: "password123",
        });

      const sessionId = registerResponse.body.session.session_id;

      // Manually expire the session
      await testPool.query(
        "UPDATE sessions SET expires_at = NOW() - INTERVAL '1 day' WHERE session_id = $1",
        [sessionId]
      );

      // Try to logout with expired session
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Session expired");
    });
  });

  describe("Session token formats", () => {
    it("should accept session token in Authorization Bearer header", async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "bearertest",
          email: "bearertest@example.com",
          password: "password123",
        });

      const sessionId = registerResponse.body.session.session_id;

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(response.status).toBe(200);
    });

    it("should accept session token in x-session-token header", async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "customheadertest",
          email: "customheadertest@example.com",
          password: "password123",
        });

      const sessionId = registerResponse.body.session.session_id;

      const response = await request(app)
        .post("/api/auth/logout")
        .set("x-session-token", sessionId);

      expect(response.status).toBe(200);
    });
  });

  describe("Edge cases", () => {
    it("should handle logout when user has no other sessions", async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "singlesession",
          email: "singlesession@example.com",
          password: "password123",
        });

      const sessionId = registerResponse.body.session.session_id;
      const userId = registerResponse.body.user.id;

      // Verify only one session exists
      const sessionsBefore = await testPool.query(
        "SELECT * FROM sessions WHERE user_id = $1",
        [userId]
      );
      expect(sessionsBefore.rows.length).toBe(1);

      // Logout
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(response.status).toBe(200);

      // Verify no sessions remain
      const sessionsAfter = await testPool.query(
        "SELECT * FROM sessions WHERE user_id = $1",
        [userId]
      );
      expect(sessionsAfter.rows.length).toBe(0);
    });

    it("should handle concurrent logout requests gracefully", async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "concurrentlogout",
          email: "concurrentlogout@example.com",
          password: "password123",
        });

      const sessionId = registerResponse.body.session.session_id;

      // Send two logout requests simultaneously
      const [response1, response2] = await Promise.all([
        request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${sessionId}`),
        request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${sessionId}`),
      ]);

      // One should succeed, one should fail
      const statuses = [response1.status, response2.status].sort();
      expect(statuses).toEqual([200, 401]);
    });

    it("should allow user to login again after logout", async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "relogintest",
          email: "relogintest@example.com",
          password: "password123",
        });

      const sessionId = registerResponse.body.session.session_id;

      // Logout
      await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${sessionId}`);

      // Login again
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          username: "relogintest",
          password: "password123",
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.session.session_id).not.toBe(sessionId);

      // New session should work
      const meResponse = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${loginResponse.body.session.session_id}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.username).toBe("relogintest");
    });
  });

  describe("Database integrity", () => {
    it("should not affect other users' sessions", async () => {
      // Create two users
      const user1Response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "user1",
          email: "user1@example.com",
          password: "password123",
        });

      const user2Response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "user2",
          email: "user2@example.com",
          password: "password123",
        });

      const user1Session = user1Response.body.session.session_id;
      const user2Session = user2Response.body.session.session_id;

      // User1 logs out
      await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${user1Session}`);

      // User2's session should still work
      const user2MeResponse = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${user2Session}`);

      expect(user2MeResponse.status).toBe(200);
      expect(user2MeResponse.body.username).toBe("user2");
    });

    it("should properly cascade delete when user is deleted", async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "cascadetest",
          email: "cascadetest@example.com",
          password: "password123",
        });

      const userId = registerResponse.body.user.id;
      const sessionId = registerResponse.body.session.session_id;

      // Verify session exists
      const sessionBefore = await testPool.query(
        "SELECT * FROM sessions WHERE session_id = $1",
        [sessionId]
      );
      expect(sessionBefore.rows.length).toBe(1);

      // Delete user (should cascade to sessions)
      await testPool.query("DELETE FROM users WHERE id = $1", [userId]);

      // Verify session is also deleted
      const sessionAfter = await testPool.query(
        "SELECT * FROM sessions WHERE session_id = $1",
        [sessionId]
      );
      expect(sessionAfter.rows.length).toBe(0);
    });
  });

  describe("Response format", () => {
    it("should return JSON response", async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "jsontest",
          email: "jsontest@example.com",
          password: "password123",
        });

      const sessionId = registerResponse.body.session.session_id;

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(response.headers["content-type"]).toMatch(/json/);
      expect(response.body).toBeTypeOf("object");
    });

    it("should not expose sensitive information in response", async () => {
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          username: "sensitivetest",
          email: "sensitivetest@example.com",
          password: "password123",
        });

      const sessionId = registerResponse.body.session.session_id;

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(response.body).not.toHaveProperty("password");
      expect(response.body).not.toHaveProperty("session_id");
      expect(response.body).not.toHaveProperty("user_id");
      expect(response.body).toHaveProperty("message");
    });
  });
});
