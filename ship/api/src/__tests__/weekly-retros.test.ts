import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createWeeklyRetrosRouter } from "../routes/weekly-retros.js";
import { createAuthRouter } from "../routes/auth.js";

const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter(testPool));
app.use("/api/weekly-retros", createWeeklyRetrosRouter(testPool));

let sessionToken: string;
let userId: string;
let weekId: string;
let planId: string;

describe("Weekly Retros API", () => {
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
        status VARCHAR(20) DEFAULT 'draft',
        submitted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        UNIQUE(user_id, week_id)
      )
    `);
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS weekly_retros (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_id UUID REFERENCES weeks(id) ON DELETE SET NULL,
        plan_id UUID REFERENCES weekly_plans(id) ON DELETE SET NULL,
        went_well TEXT NOT NULL DEFAULT '',
        to_improve TEXT NOT NULL DEFAULT '',
        action_items TEXT NOT NULL DEFAULT '',
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'changes_requested')),
        submitted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        UNIQUE(user_id, week_id)
      )
    `);

    // Register and login
    await request(app)
      .post("/api/auth/register")
      .send({ username: "retrouser", email: "retro@test.com", password: "test123" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "retro@test.com", password: "test123" });

    sessionToken = loginRes.body.sessionToken;
    userId = loginRes.body.user.id;

    // Create a test week and plan
    const weekRes = await testPool.query("INSERT INTO weeks (title) VALUES ('Week 1') RETURNING id");
    weekId = weekRes.rows[0].id;

    const planRes = await testPool.query(
      "INSERT INTO weekly_plans (user_id, week_id, plan_content) VALUES ($1, $2, 'Test plan') RETURNING id",
      [userId, weekId]
    );
    planId = planRes.rows[0].id;
  });

  afterAll(async () => {
    await testPool.query("DROP TABLE IF EXISTS weekly_retros CASCADE");
    await testPool.query("DROP TABLE IF EXISTS weekly_plans CASCADE");
    await testPool.query("DROP TABLE IF EXISTS weeks CASCADE");
    await testPool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await testPool.query("DROP TABLE IF EXISTS users CASCADE");
    await testPool.end();
  });

  beforeEach(async () => {
    await testPool.query("DELETE FROM weekly_retros");
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/weekly-retros");
    expect(res.status).toBe(401);
  });

  it("creates a retro linked to a plan", async () => {
    const res = await request(app)
      .post("/api/weekly-retros")
      .set("x-session-token", sessionToken)
      .send({
        week_id: weekId,
        plan_id: planId,
        went_well: "Shipped kanban feature",
        to_improve: "More testing",
        action_items: "Add live evals",
      });

    expect(res.status).toBe(201);
    expect(res.body.went_well).toBe("Shipped kanban feature");
    expect(res.body.to_improve).toBe("More testing");
    expect(res.body.action_items).toBe("Add live evals");
    expect(res.body.plan_id).toBe(planId);
    expect(res.body.status).toBe("draft");
  });

  it("submits a retro", async () => {
    const create = await request(app)
      .post("/api/weekly-retros")
      .set("x-session-token", sessionToken)
      .send({ week_id: weekId, went_well: "Good", to_improve: "Better", action_items: "Do" });

    const res = await request(app)
      .patch(`/api/weekly-retros/${create.body.id}/submit`)
      .set("x-session-token", sessionToken);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("submitted");
  });

  it("soft deletes a retro", async () => {
    const create = await request(app)
      .post("/api/weekly-retros")
      .set("x-session-token", sessionToken)
      .send({ week_id: weekId, went_well: "X", to_improve: "Y", action_items: "Z" });

    await request(app)
      .delete(`/api/weekly-retros/${create.body.id}`)
      .set("x-session-token", sessionToken);

    const list = await request(app)
      .get("/api/weekly-retros")
      .set("x-session-token", sessionToken);
    expect(list.body).toHaveLength(0);
  });
});
