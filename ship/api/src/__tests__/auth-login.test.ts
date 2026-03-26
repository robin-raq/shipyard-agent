import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createAuthRouter } from "../routes/auth.js";

/**
 * Focused tests for POST /api/auth/login endpoint
 * 
 * These tests verify that the login endpoint:
 * 1. Returns a valid session object with session_id
 * 2. Returns complete user profile data
 * 3. Does not expose sensitive data (password)
 * 4. Creates a session that can be used for authentication
 */

// Test database setup
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter(testPool));

describe("POST /api/auth/login - Valid Credentials", () => {
  const testUser = {
    username: "validuser",
    email: "validuser@example.com",
    password: "securePassword123",
  };

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

    // Register test user
    await request(app)
      .post("/api/auth/register")
      .send(testUser);
  });

  afterAll(async () => {
    // Clean up sessions for this test suite
    await testPool.query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = $1)", [testUser.username]);
  });

  describe("Response Structure", () => {
    it("should return 200 status code on successful login", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
    });

    it("should return user object with correct properties", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty("username");
      expect(response.body.user).toHaveProperty("email");
      expect(response.body.user).toHaveProperty("created_at");
      expect(response.body.user).toHaveProperty("updated_at");
    });

    it("should return session object with correct properties", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(response.body).toHaveProperty("session");
      expect(response.body.session).toHaveProperty("session_id");
      expect(response.body.session).toHaveProperty("user_id");
      expect(response.body.session).toHaveProperty("created_at");
      expect(response.body.session).toHaveProperty("expires_at");
    });

    it("should return correct user data", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(response.body.user.username).toBe(testUser.username);
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.id).toBeDefined();
      expect(typeof response.body.user.id).toBe("string");
    });

    it("should NOT include password in response", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(response.body.user).not.toHaveProperty("password");
    });
  });

  describe("Session Token Validation", () => {
    it("should return a valid UUID as session_id", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const sessionId = response.body.session.session_id;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(uuidRegex);
    });

    it("should create a session that matches the user_id", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(response.body.session.user_id).toBe(response.body.user.id);
    });

    it("should set session expiration in the future", async () => {
      const beforeLogin = Date.now();
      
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const expiresAt = new Date(response.body.session.expires_at).getTime();
      const afterLogin = Date.now();

      // Session should expire in the future
      expect(expiresAt).toBeGreaterThan(afterLogin);
      
      // Session should expire at least 1 day in the future (86400000 ms)
      const oneDayFromNow = beforeLogin + 86400000;
      expect(expiresAt).toBeGreaterThan(oneDayFromNow);
    });

    it("should create a session that persists in the database", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const sessionId = response.body.session.session_id;

      // Verify session exists in database
      const sessionCheck = await testPool.query(
        "SELECT * FROM sessions WHERE session_id = $1",
        [sessionId]
      );

      expect(sessionCheck.rows.length).toBe(1);
      expect(sessionCheck.rows[0].session_id).toBe(sessionId);
      expect(sessionCheck.rows[0].user_id).toBe(response.body.user.id);
    });
  });

  describe("Session Usability", () => {
    it("should create a session that can be used to access protected routes", async () => {
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const sessionId = loginResponse.body.session.session_id;

      // Use the session to access a protected route
      const meResponse = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${sessionId}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.username).toBe(testUser.username);
      expect(meResponse.body.email).toBe(testUser.email);
    });

    it("should create unique sessions for each login", async () => {
      const login1 = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const login2 = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(login1.body.session.session_id).not.toBe(login2.body.session.session_id);
      
      // Both sessions should be valid
      const me1 = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${login1.body.session.session_id}`);

      const me2 = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${login2.body.session.session_id}`);

      expect(me1.status).toBe(200);
      expect(me2.status).toBe(200);
    });
  });

  describe("Response Format", () => {
    it("should return JSON content type", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });

    it("should have consistent timestamp formats", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      // Verify timestamps are valid ISO 8601 dates
      const userCreatedAt = new Date(response.body.user.created_at);
      const userUpdatedAt = new Date(response.body.user.updated_at);
      const sessionCreatedAt = new Date(response.body.session.created_at);
      const sessionExpiresAt = new Date(response.body.session.expires_at);

      expect(userCreatedAt.toString()).not.toBe("Invalid Date");
      expect(userUpdatedAt.toString()).not.toBe("Invalid Date");
      expect(sessionCreatedAt.toString()).not.toBe("Invalid Date");
      expect(sessionExpiresAt.toString()).not.toBe("Invalid Date");
    });
  });

  describe("Data Integrity", () => {
    it("should return the same user data across multiple logins", async () => {
      const login1 = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const login2 = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      // User data should be identical
      expect(login1.body.user.id).toBe(login2.body.user.id);
      expect(login1.body.user.username).toBe(login2.body.user.username);
      expect(login1.body.user.email).toBe(login2.body.user.email);
      expect(login1.body.user.created_at).toBe(login2.body.user.created_at);
    });

    it("should maintain referential integrity between user and session", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      // Verify the session's user_id matches the returned user's id
      expect(response.body.session.user_id).toBe(response.body.user.id);

      // Verify in database
      const dbCheck = await testPool.query(
        `SELECT s.session_id, s.user_id, u.id as user_table_id
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.session_id = $1`,
        [response.body.session.session_id]
      );

      expect(dbCheck.rows.length).toBe(1);
      expect(dbCheck.rows[0].user_id).toBe(dbCheck.rows[0].user_table_id);
    });
  });
});

describe("POST /api/auth/login - Invalid Credentials", () => {
  const testUser = {
    username: "invalidtestuser",
    email: "invalidtest@example.com",
    password: "correctPassword123",
  };

  beforeAll(async () => {
    // Create tables for testing (if not already created)
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

    // Register test user for invalid login attempts
    await request(app)
      .post("/api/auth/register")
      .send(testUser);
  });

  afterAll(async () => {
    // Clean up sessions for this test suite
    await testPool.query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = $1)", [testUser.username]);
  });

  describe("Wrong Password", () => {
    it("should return 401 status code for incorrect password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: "wrongPassword123",
        });

      expect(response.status).toBe(401);
    });

    it("should return error message for incorrect password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: "wrongPassword123",
        });

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe(true);
      expect(response.body).toHaveProperty("message");
      expect(typeof response.body.message).toBe("string");
      expect(response.body.message.length).toBeGreaterThan(0);
    });

    it("should NOT return user data for incorrect password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: "wrongPassword123",
        });

      expect(response.body).not.toHaveProperty("user");
      expect(response.body).not.toHaveProperty("session");
    });

    it("should NOT create a session for incorrect password", async () => {
      const beforeCount = await testPool.query(
        "SELECT COUNT(*) FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = $1)",
        [testUser.username]
      );

      await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: "wrongPassword123",
        });

      const afterCount = await testPool.query(
        "SELECT COUNT(*) FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = $1)",
        [testUser.username]
      );

      expect(afterCount.rows[0].count).toBe(beforeCount.rows[0].count);
    });

    it("should return JSON content type for incorrect password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: "wrongPassword123",
        });

      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });
  });

  describe("Non-existent User", () => {
    it("should return 401 status code for non-existent username", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "nonexistentuser999",
          password: "anyPassword123",
        });

      expect(response.status).toBe(401);
    });

    it("should return error message for non-existent username", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "nonexistentuser999",
          password: "anyPassword123",
        });

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe(true);
      expect(response.body).toHaveProperty("message");
      expect(typeof response.body.message).toBe("string");
    });

    it("should NOT return user data for non-existent username", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "nonexistentuser999",
          password: "anyPassword123",
        });

      expect(response.body).not.toHaveProperty("user");
      expect(response.body).not.toHaveProperty("session");
    });

    it("should return 401 for non-existent email", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "nonexistent@example.com",
          password: "anyPassword123",
        });

      expect(response.status).toBe(401);
    });
  });

  describe("Missing or Invalid Input", () => {
    it("should return 400 for missing username", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          password: testUser.password,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe(true);
    });

    it("should return 400 for missing password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe(true);
    });

    it("should return 400 for empty username", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "",
          password: testUser.password,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe(true);
    });

    it("should return 400 for empty password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: "",
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe(true);
    });

    it("should return 400 for empty request body", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe(true);
    });
  });

  describe("Security Considerations", () => {
    it("should not reveal whether username exists (timing-safe)", async () => {
      // Both non-existent user and wrong password should return same error structure
      const nonExistentResponse = await request(app)
        .post("/api/auth/login")
        .send({
          username: "definitelynotauser",
          password: "somePassword",
        });

      const wrongPasswordResponse = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: "wrongPassword",
        });

      // Both should return 401
      expect(nonExistentResponse.status).toBe(401);
      expect(wrongPasswordResponse.status).toBe(401);

      // Both should have error property set to true
      expect(nonExistentResponse.body).toHaveProperty("error");
      expect(wrongPasswordResponse.body).toHaveProperty("error");
      expect(nonExistentResponse.body.error).toBe(true);
      expect(wrongPasswordResponse.body.error).toBe(true);

      // Both should have message property
      expect(nonExistentResponse.body).toHaveProperty("message");
      expect(wrongPasswordResponse.body).toHaveProperty("message");

      // Error messages should be generic (not revealing if user exists)
      // This is a security best practice to prevent user enumeration
      expect(typeof nonExistentResponse.body.message).toBe("string");
      expect(typeof wrongPasswordResponse.body.message).toBe("string");
      // Messages should be the same to prevent user enumeration
      expect(nonExistentResponse.body.message).toBe(wrongPasswordResponse.body.message);
    });

    it("should NOT expose password hash or any user data on failed login", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: "wrongPassword",
        });

      expect(response.body).not.toHaveProperty("user");
      expect(response.body).not.toHaveProperty("password");
      expect(response.body).not.toHaveProperty("hash");
      expect(response.body).not.toHaveProperty("id");
    });

    it("should handle SQL injection attempts safely", async () => {
      const sqlInjectionAttempts = [
        "admin' OR '1'='1",
        "admin'--",
        "admin' OR '1'='1'--",
        "'; DROP TABLE users; --",
      ];

      for (const maliciousInput of sqlInjectionAttempts) {
        const response = await request(app)
          .post("/api/auth/login")
          .send({
            username: maliciousInput,
            password: "anyPassword",
          });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty("error");
      }

      // Verify tables still exist
      const tableCheck = await testPool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_name = 'users'"
      );
      expect(tableCheck.rows.length).toBe(1);
    });
  });

  describe("Case Sensitivity", () => {
    it("should return 401 for username with wrong case", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username.toUpperCase(),
          password: testUser.password,
        });

      // Assuming usernames are case-sensitive
      expect(response.status).toBe(401);
    });

    it("should return 401 for password with wrong case", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: testUser.password.toUpperCase(),
        });

      // Passwords should always be case-sensitive
      expect(response.status).toBe(401);
    });
  });

  describe("Edge Cases", () => {
    it("should return 400 for null username", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: null,
          password: testUser.password,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe(true);
    });

    it("should return 400 for null password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: null,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe(true);
    });

    it("should return 401 for very long username", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "a".repeat(1000),
          password: testUser.password,
        });

      expect(response.status).toBe(401);
    });

    it("should return 401 for very long password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: "a".repeat(1000),
        });

      expect(response.status).toBe(401);
    });

    it("should return 401 for whitespace-only username", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "   ",
          password: testUser.password,
        });

      expect(response.status).toBe(401);
    });

    it("should return 401 for whitespace-only password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: testUser.username,
          password: "   ",
        });

      expect(response.status).toBe(401);
    });
  });
});

// Global cleanup after all test suites
afterAll(async () => {
  // Drop tables and close pool connection
  await testPool.query("DROP TABLE IF EXISTS sessions CASCADE");
  await testPool.query("DROP TABLE IF EXISTS users CASCADE");
  await testPool.end();
});
