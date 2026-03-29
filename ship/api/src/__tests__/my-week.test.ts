import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createAuthRouter } from "../routes/auth.js";
import { createMyWeekRouter } from "../routes/my-week.js";

// Test database setup (matches pattern used across API tests)
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter(testPool));
app.use("/api/my-week", createMyWeekRouter(testPool));

let sessionToken: string;
let userId: string;
let currentWeekId: string;
let otherWeekId: string;

// Helper to get ISO date string for N days offset from today
function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Return YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

describe("MyWeek API", () => {
  beforeAll(async () => {
    // Core auth tables
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
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

    // Domain tables required by MyWeek route
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS weeks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        start_date DATE,
        end_date DATE,
        deleted_at TIMESTAMPTZ DEFAULT NULL
      )
    `);

    // Ensure schema compatibility with other tests that may have created different columns
    await testPool.query(`ALTER TABLE weeks ADD COLUMN IF NOT EXISTS start_date DATE`);
    await testPool.query(`ALTER TABLE weeks ADD COLUMN IF NOT EXISTS end_date DATE`);
    await testPool.query(`ALTER TABLE weeks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS standups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        standup_date DATE NOT NULL,
        yesterday TEXT,
        today TEXT,
        blockers TEXT,
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Ensure standup_date and deleted_at exist (in case a different schema was created by other tests)
    await testPool.query(`ALTER TABLE standups ADD COLUMN IF NOT EXISTS standup_date DATE`);
    await testPool.query(`ALTER TABLE standups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS weekly_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_id UUID REFERENCES weeks(id) ON DELETE SET NULL,
        plan_content TEXT NOT NULL DEFAULT '',
        status VARCHAR(20) DEFAULT 'draft',
        submitted_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, week_id)
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS weekly_retros (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_id UUID REFERENCES weeks(id) ON DELETE SET NULL,
        went_well TEXT NOT NULL DEFAULT '',
        to_improve TEXT NOT NULL DEFAULT '',
        action_items TEXT NOT NULL DEFAULT '',
        status VARCHAR(20) DEFAULT 'draft',
        submitted_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, week_id)
      )
    `);

    // Register and login test user
    await request(app)
      .post("/api/auth/register")
      .send({ username: "myweekuser", email: "myweek@test.com", password: "test12345" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "myweekuser", password: "test12345" });

    // Follow auth.test.ts pattern
    sessionToken = loginRes.body.session.session_id;
    userId = loginRes.body.user.id;

    // Seed data: create a current week that includes today
    const currentStart = isoDate(-1); // yesterday
    const currentEnd = isoDate(5);    // 5 days from now
    const currentWeek = await testPool.query(
      `INSERT INTO weeks (start_date, end_date) VALUES ($1, $2) RETURNING id`,
      [currentStart, currentEnd]
    );
    currentWeekId = currentWeek.rows[0].id;

    // Create a past week (does not include today)
    const pastStart = isoDate(-20);
    const pastEnd = isoDate(-14);
    const otherWeek = await testPool.query(
      `INSERT INTO weeks (start_date, end_date) VALUES ($1, $2) RETURNING id`,
      [pastStart, pastEnd]
    );
    otherWeekId = otherWeek.rows[0].id;

    // Today's standup for the user
    await testPool.query(
      `INSERT INTO standups (user_id, standup_date, yesterday, today, blockers) VALUES ($1, CURRENT_DATE, 'Did X', 'Do Y', 'None')`,
      [userId]
    );

    // Plan & retro for current week
    await testPool.query(
      `INSERT INTO weekly_plans (user_id, week_id, plan_content, status) VALUES ($1, $2, 'Current week plan', 'draft')`,
      [userId, currentWeekId]
    );
    await testPool.query(
      `INSERT INTO weekly_retros (user_id, week_id, went_well, to_improve, action_items, status) VALUES ($1, $2, 'Good', 'Better', 'Do', 'draft')`,
      [userId, currentWeekId]
    );

    // Plan & retro for other (past) week
    await testPool.query(
      `INSERT INTO weekly_plans (user_id, week_id, plan_content, status) VALUES ($1, $2, 'Other week plan', 'submitted')`,
      [userId, otherWeekId]
    );
    await testPool.query(
      `INSERT INTO weekly_retros (user_id, week_id, went_well, to_improve, action_items, status) VALUES ($1, $2, 'Past Good', 'Past Better', 'Past Do', 'approved')`,
      [userId, otherWeekId]
    );
  });

  afterAll(async () => {
    await testPool.query("DROP TABLE IF EXISTS weekly_retros CASCADE");
    await testPool.query("DROP TABLE IF EXISTS weekly_plans CASCADE");
    await testPool.query("DROP TABLE IF EXISTS standups CASCADE");
    await testPool.query("DROP TABLE IF EXISTS weeks CASCADE");
    await testPool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await testPool.query("DROP TABLE IF EXISTS users CASCADE");
    await testPool.end();
  });

  beforeEach(async () => {
    // No-op: keep seeded data for tests. Individual tests may insert/delete more.
  });

  describe("GET /api/my-week (current week)", () => {
    it("requires authentication", async () => {
      const res = await request(app).get("/api/my-week");
      expect(res.status).toBe(401);
    });

    it("returns current week summary with standup, plan, and retro", async () => {
      const res = await request(app)
        .get("/api/my-week")
        .set("x-session-token", sessionToken);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("week");
      expect(res.body.week).toHaveProperty("id", currentWeekId);

      // Standup for today
      expect(res.body).toHaveProperty("standup");
      expect(res.body.standup?.user_id).toBe(userId);
      expect(res.body.standup).toHaveProperty("standup_date");

      // Weekly plan
      expect(res.body).toHaveProperty("plan");
      expect(res.body.plan?.user_id).toBe(userId);
      expect(res.body.plan?.week_id).toBe(currentWeekId);
      expect(res.body.plan?.plan_content).toBe("Current week plan");
      expect(["draft", "submitted", "approved"]).toContain(res.body.plan?.status);

      // Weekly retro
      expect(res.body).toHaveProperty("retro");
      expect(res.body.retro?.user_id).toBe(userId);
      expect(res.body.retro?.week_id).toBe(currentWeekId);
      expect(res.body.retro?.went_well).toBe("Good");
    });
  });

  describe("GET /api/my-week?week_id=... (specific week)", () => {
    it("returns data for the specified week id", async () => {
      const res = await request(app)
        .get(`/api/my-week?week_id=${otherWeekId}`)
        .set("x-session-token", sessionToken);

      expect(res.status).toBe(200);
      expect(res.body.week).toHaveProperty("id", otherWeekId);

      // Standup is always for today (independent of week selection)
      expect(res.body.standup?.user_id).toBe(userId);

      // Plan/retro correspond to selected week
      expect(res.body.plan?.week_id).toBe(otherWeekId);
      expect(res.body.plan?.plan_content).toBe("Other week plan");
      expect(res.body.retro?.week_id).toBe(otherWeekId);
      expect(res.body.retro?.went_well).toBe("Past Good");
    });

    it("returns 404 for missing week id", async () => {
      const res = await request(app)
        .get(`/api/my-week?week_id=00000000-0000-0000-0000-000000000000`)
        .set("x-session-token", sessionToken);

      expect(res.status).toBe(404);
      expect(String(res.body.message || "").toLowerCase()).toContain("week not found");
    });

    it("returns null plan/retro when they do not exist for the week", async () => {
      // Create a future week with no plan/retro
      const futureStart = isoDate(30);
      const futureEnd = isoDate(37);
      const future = await testPool.query(
        `INSERT INTO weeks (start_date, end_date) VALUES ($1, $2) RETURNING id`,
        [futureStart, futureEnd]
      );
      const futureWeekId = future.rows[0].id;

      const res = await request(app)
        .get(`/api/my-week?week_id=${futureWeekId}`)
        .set("x-session-token", sessionToken);

      expect(res.status).toBe(200);
      expect(res.body.week?.id).toBe(futureWeekId);
      expect(res.body.plan).toBeNull();
      expect(res.body.retro).toBeNull();
      // Standup may still be present if today has a standup
      expect([null, userId]).toContain(res.body.standup?.user_id ?? null);
    });
  });
});
