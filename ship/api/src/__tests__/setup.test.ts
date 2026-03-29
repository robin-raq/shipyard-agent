import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createAuthRouter } from "../routes/auth.js";
import { createSetupRouter } from "../routes/setup.js";

// Test database setup (match auth.test.ts pattern)
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter(testPool));
app.use("/api/setup", createSetupRouter(testPool));

describe("Setup API", () => {
  let sessionToken: string;
  let userId: string;

  beforeAll(async () => {
    // Create tables for testing (same style as auth.test.ts)
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
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

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        theme VARCHAR(10) NOT NULL DEFAULT 'system',
        notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        email_digest VARCHAR(10) NOT NULL DEFAULT 'weekly',
        default_view VARCHAR(10) NOT NULL DEFAULT 'list',
        timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        setup_completed BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT DEFAULT ''
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT DEFAULT ''
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS standups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Register test user then login to obtain session token
    const username = "setupuser";
    const email = "setupuser@example.com";
    const password = "password123";

    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({ username, email, password });

    expect(registerResponse.status).toBe(201);
    userId = registerResponse.body.user.id;

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ username, password });

    expect(loginResponse.status).toBe(200);
    sessionToken = loginResponse.body.session.session_id;
  });

  afterAll(async () => {
    await testPool.query("DROP TABLE IF EXISTS standups CASCADE");
    await testPool.query("DROP TABLE IF EXISTS projects CASCADE");
    await testPool.query("DROP TABLE IF EXISTS teams CASCADE");
    await testPool.query("DROP TABLE IF EXISTS user_settings CASCADE");
    await testPool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await testPool.query("DROP TABLE IF EXISTS users CASCADE");
    await testPool.end();
  });

  it("GET /api/setup/status without token should return 401", async () => {
    const res = await request(app).get("/api/setup/status");
    expect(res.status).toBe(401);
  });

  it("GET /api/setup/status with token should return 200 and completed: false with per-step flags", async () => {
    const res = await request(app)
      .get("/api/setup/status")
      .set("x-session-token", sessionToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("completed", false);
    expect(Array.isArray(res.body.steps)).toBe(true);
    // Verify steps shape and boolean flags without assuming specific values
    for (const step of res.body.steps) {
      expect(step).toHaveProperty("name");
      expect(step).toHaveProperty("label");
      expect(typeof step.done).toBe("boolean");
    }
  });

  it("steps should reflect actual data (create_team done if a team exists)", async () => {
    // Insert a team
    await testPool.query(
      `INSERT INTO teams (name, description) VALUES ($1, $2)`,
      ["Test Team", "A team for testing"]
    );

    const res = await request(app)
      .get("/api/setup/status")
      .set("x-session-token", sessionToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("completed", false);
    const steps = Object.fromEntries(res.body.steps.map((s: any) => [s.name, s.done]));
    expect(steps["create_team"]).toBe(true);
    expect(steps["create_project"]).toBe(false);
    expect(steps["first_standup"]).toBe(false);
  });

  it("POST /api/setup/complete should return 200 and mark setup as done", async () => {
    const res = await request(app)
      .post("/api/setup/complete")
      .set("x-session-token", sessionToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);

    // Verify DB flag set
    const check = await testPool.query(
      `SELECT setup_completed FROM user_settings WHERE user_id = $1`,
      [userId]
    );
    expect(check.rows.length).toBe(1);
    expect(check.rows[0].setup_completed).toBe(true);
  });

  it("GET /api/setup/status after complete should return completed: true", async () => {
    const res = await request(app)
      .get("/api/setup/status")
      .set("x-session-token", sessionToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("completed", true);

    const steps = Object.fromEntries(res.body.steps.map((s: any) => [s.name, s.done]));
    expect(steps["create_team"]).toBe(true);
    expect(steps["create_project"]).toBe(true);
    expect(steps["first_standup"]).toBe(true);
  });
});
