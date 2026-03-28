import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createWeeklyPlansRouter } from "../routes/weekly-plans.js";
import { createAuthRouter } from "../routes/auth.js";
import { createAuthMiddleware } from "../middleware/auth.js";

const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter(testPool));
app.use("/api/weekly-plans", createWeeklyPlansRouter(testPool));

let sessionToken: string;
let userId: string;
let weekId: string;

describe("Weekly Plans API", () => {
  beforeAll(async () => {
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
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
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS weeks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        content TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ DEFAULT NULL
      )
    `);
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS weekly_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_id UUID REFERENCES weeks(id) ON DELETE SET NULL,
        plan_content TEXT NOT NULL DEFAULT '',
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'changes_requested')),
        submitted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        UNIQUE(user_id, week_id)
      )
    `);

    // Register and login a test user
    await request(app)
      .post("/api/auth/register")
      .send({ username: "planuser", email: "plan@test.com", password: "test123" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "plan@test.com", password: "test123" });

    sessionToken = loginRes.body.sessionToken;
    userId = loginRes.body.user.id;

    // Create a test week
    const weekRes = await testPool.query(
      "INSERT INTO weeks (title) VALUES ('Week 1') RETURNING id"
    );
    weekId = weekRes.rows[0].id;
  });

  afterAll(async () => {
    await testPool.query("DROP TABLE IF EXISTS weekly_plans CASCADE");
    await testPool.query("DROP TABLE IF EXISTS weeks CASCADE");
    await testPool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await testPool.query("DROP TABLE IF EXISTS users CASCADE");
    await testPool.end();
  });

  beforeEach(async () => {
    await testPool.query("DELETE FROM weekly_plans");
  });

  describe("GET /api/weekly-plans", () => {
    it("requires authentication", async () => {
      const res = await request(app).get("/api/weekly-plans");
      expect(res.status).toBe(401);
    });

    it("returns empty array when no plans exist", async () => {
      const res = await request(app)
        .get("/api/weekly-plans")
        .set("x-session-token", sessionToken);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("filters by week_id", async () => {
      await testPool.query(
        "INSERT INTO weekly_plans (user_id, week_id, plan_content) VALUES ($1, $2, 'Plan A')",
        [userId, weekId]
      );
      const res = await request(app)
        .get(`/api/weekly-plans?week_id=${weekId}`)
        .set("x-session-token", sessionToken);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].plan_content).toBe("Plan A");
    });
  });

  describe("POST /api/weekly-plans", () => {
    it("creates a plan", async () => {
      const res = await request(app)
        .post("/api/weekly-plans")
        .set("x-session-token", sessionToken)
        .send({ week_id: weekId, plan_content: "My weekly plan" });
      expect(res.status).toBe(201);
      expect(res.body.plan_content).toBe("My weekly plan");
      expect(res.body.status).toBe("draft");
      expect(res.body.user_id).toBe(userId);
    });

    it("upserts on same user+week", async () => {
      await request(app)
        .post("/api/weekly-plans")
        .set("x-session-token", sessionToken)
        .send({ week_id: weekId, plan_content: "Version 1" });

      const res = await request(app)
        .post("/api/weekly-plans")
        .set("x-session-token", sessionToken)
        .send({ week_id: weekId, plan_content: "Version 2" });

      expect(res.status).toBe(201);
      expect(res.body.plan_content).toBe("Version 2");

      // Should still be only 1 plan
      const list = await request(app)
        .get(`/api/weekly-plans?week_id=${weekId}`)
        .set("x-session-token", sessionToken);
      expect(list.body).toHaveLength(1);
    });
  });

  describe("PUT /api/weekly-plans/:id", () => {
    it("updates plan content (author only)", async () => {
      const create = await request(app)
        .post("/api/weekly-plans")
        .set("x-session-token", sessionToken)
        .send({ week_id: weekId, plan_content: "Original" });

      const res = await request(app)
        .put(`/api/weekly-plans/${create.body.id}`)
        .set("x-session-token", sessionToken)
        .send({ plan_content: "Updated plan" });

      expect(res.status).toBe(200);
      expect(res.body.plan_content).toBe("Updated plan");
    });
  });

  describe("PATCH /api/weekly-plans/:id/submit", () => {
    it("submits a draft plan", async () => {
      const create = await request(app)
        .post("/api/weekly-plans")
        .set("x-session-token", sessionToken)
        .send({ week_id: weekId, plan_content: "My plan" });

      const res = await request(app)
        .patch(`/api/weekly-plans/${create.body.id}/submit`)
        .set("x-session-token", sessionToken);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("submitted");
      expect(res.body.submitted_at).toBeTruthy();
    });
  });

  describe("DELETE /api/weekly-plans/:id", () => {
    it("soft deletes a plan", async () => {
      const create = await request(app)
        .post("/api/weekly-plans")
        .set("x-session-token", sessionToken)
        .send({ week_id: weekId, plan_content: "To delete" });

      const res = await request(app)
        .delete(`/api/weekly-plans/${create.body.id}`)
        .set("x-session-token", sessionToken);

      expect(res.status).toBe(200);

      // Should not appear in list
      const list = await request(app)
        .get("/api/weekly-plans")
        .set("x-session-token", sessionToken);
      expect(list.body).toHaveLength(0);
    });
  });
});
