import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createAuthRouter } from "../routes/auth.js";
import { createProfileRouter } from "../routes/profile.js";

// Test database setup (follow pattern used in other API tests)
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter(testPool));
app.use("/api/profile", createProfileRouter(testPool));

let sessionToken: string;
let userId: string;

describe("Profile API", () => {
  beforeAll(async () => {
    // Create core auth tables with all columns used by profile routes
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        display_name VARCHAR(255),
        bio TEXT,
        avatar_url TEXT,
        phone VARCHAR(50),
        location VARCHAR(255),
        title VARCHAR(255),
        department VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Register a user and get a session (reuse existing auth routes to keep parity with other tests)
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ username: "profileuser", email: "profile@test.com", password: "test12345" });

    expect(registerRes.status).toBeTypeOf("number"); // sanity

    sessionToken = registerRes.body.session.session_id;
    userId = registerRes.body.user.id;
  });

  afterAll(async () => {
    await testPool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await testPool.query("DROP TABLE IF EXISTS users CASCADE");
    await testPool.end();
  });

  describe("GET /api/profile/ (current user)", () => {
    it("requires authentication", async () => {
      const res = await request(app).get("/api/profile");
      expect(res.status).toBe(401);
      expect(String(res.body.message || "").toLowerCase()).toContain("authentication required");
    });

    it("returns current user's profile with expected shape and default fields", async () => {
      const res = await request(app)
        .get("/api/profile")
        .set("x-session-token", sessionToken);

      expect(res.status).toBe(200);
      // Required identity fields
      expect(res.body).toHaveProperty("id", userId);
      expect(res.body).toHaveProperty("username", "profileuser");
      expect(res.body).toHaveProperty("email", "profile@test.com");
      // Optional fields should exist and default to empty string when null
      expect(res.body).toHaveProperty("displayName");
      expect(res.body).toHaveProperty("bio");
      expect(res.body).toHaveProperty("avatarUrl");
      expect(res.body).toHaveProperty("phone");
      expect(res.body).toHaveProperty("location");
      expect(res.body).toHaveProperty("title");
      expect(res.body).toHaveProperty("department");
      expect(typeof res.body.displayName).toBe("string");
      expect(typeof res.body.bio).toBe("string");
      expect(typeof res.body.avatarUrl).toBe("string");
      expect(typeof res.body.phone).toBe("string");
      expect(typeof res.body.location).toBe("string");
      expect(typeof res.body.title).toBe("string");
      expect(typeof res.body.department).toBe("string");
      // Role and createdAt
      expect(res.body).toHaveProperty("role");
      expect(res.body).toHaveProperty("createdAt");
      expect(!Number.isNaN(Date.parse(res.body.createdAt))).toBe(true);
      // Security: must not include password
      expect(res.body).not.toHaveProperty("password");
    });

    it("accepts Authorization Bearer token as well", async () => {
      const res = await request(app)
        .get("/api/profile")
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id", userId);
    });
  });

  describe("PUT /api/profile/ (update current user)", () => {
    it("updates provided fields and returns updated profile", async () => {
      const payload = {
        displayName: "Profile User",
        bio: "Building ships fast.",
        avatarUrl: "https://example.com/avatar.png",
        phone: "+1-555-0000",
        location: "Remote",
      };

      const res = await request(app)
        .put("/api/profile")
        .set("x-session-token", sessionToken)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("displayName", payload.displayName);
      expect(res.body).toHaveProperty("bio", payload.bio);
      expect(res.body).toHaveProperty("avatarUrl", payload.avatarUrl);
      expect(res.body).toHaveProperty("phone", payload.phone);
      expect(res.body).toHaveProperty("location", payload.location);
      // Ensure other fields still present
      expect(res.body).toHaveProperty("username", "profileuser");
      expect(res.body).toHaveProperty("email", "profile@test.com");
      expect(res.body).not.toHaveProperty("password");
    });

    it("returns 400 when no updatable fields provided", async () => {
      const res = await request(app)
        .put("/api/profile")
        .set("x-session-token", sessionToken)
        .send({});

      expect(res.status).toBe(400);
      expect(String(res.body.message || "").toLowerCase()).toContain("no fields to update");
    });

    it("validates field types and rejects invalid payloads", async () => {
      const res1 = await request(app)
        .put("/api/profile")
        .set("x-session-token", sessionToken)
        // @ts-expect-error send invalid type on purpose
        .send({ displayName: 12345 });
      expect(res1.status).toBe(400);
      expect(String(res1.body.message || "").toLowerCase()).toContain("invalid displayname");

      const res2 = await request(app)
        .put("/api/profile")
        .set("x-session-token", sessionToken)
        // @ts-expect-error send invalid type on purpose
        .send({ bio: { foo: "bar" } });
      expect(res2.status).toBe(400);
      expect(String(res2.body.message || "").toLowerCase()).toContain("invalid bio");
    });

    it("requires authentication", async () => {
      const res = await request(app).put("/api/profile").send({ displayName: "x" });
      expect(res.status).toBe(401);
      expect(String(res.body.message || "").toLowerCase()).toContain("authentication required");
    });
  });

  describe("GET /api/profile/:id (public user profile)", () => {
    it("returns the specified user's profile without authentication", async () => {
      const res = await request(app).get(`/api/profile/${userId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id", userId);
      expect(res.body).toHaveProperty("username", "profileuser");
      expect(res.body).toHaveProperty("email", "profile@test.com");
      expect(res.body).not.toHaveProperty("password");
    });

    it("returns 404 for non-existent user id", async () => {
      const res = await request(app).get(
        "/api/profile/00000000-0000-0000-0000-000000000000"
      );
      expect(res.status).toBe(404);
      expect(String(res.body.message || "").toLowerCase()).toContain("user not found");
    });
  });
});
