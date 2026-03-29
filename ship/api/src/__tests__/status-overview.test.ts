import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createAuthRouter } from "../routes/auth.js";
import { createStatusOverviewRouter } from "../routes/status-overview.js";

// Test database setup (pattern from auth.test.ts)
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter(testPool));
app.use("/api/status-overview", createStatusOverviewRouter(testPool));

let sessionToken: string;
let userId1: string;
let userId2: string;

describe("Status Overview API", () => {
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

    // Domain tables queried by the status-overview route
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS issues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT,
        content TEXT,
        status VARCHAR(50),
        priority VARCHAR(50),
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        description TEXT,
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

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

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS weeks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        start_date DATE,
        end_date DATE,
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
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

    // Register two users and capture session for user1
    await request(app)
      .post("/api/auth/register")
      .send({ username: "statususer", email: "statususer@test.com", password: "test12345" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "statususer", password: "test12345" });

    sessionToken = loginRes.body.session.session_id;
    userId1 = loginRes.body.user.id;

    const reg2 = await request(app)
      .post("/api/auth/register")
      .send({ username: "otheruser", email: "other@test.com", password: "test12345" });
    userId2 = reg2.body.user.id;

    // Seed data for aggregates
    // Projects: 3 total, 1 soft-deleted => projectCount should be 2
    await testPool.query(
      `INSERT INTO projects (title, description, status) VALUES
        ('Proj A', 'Desc', 'active'),
        ('Proj B', 'Desc', 'active'),
        ('Proj C', 'Desc', 'archived')`
    );
    // Soft-delete one project
    await testPool.query(`UPDATE projects SET deleted_at = NOW() WHERE title = 'Proj C'`);

    // Teams: 2 total, none deleted => teamCount 2
    await testPool.query(
      `INSERT INTO teams (name, description) VALUES
        ('Team Alpha', 'A'),
        ('Team Beta', 'B')`
    );

    // Issues: distribute across statuses/priorities; include one soft-deleted
    await testPool.query(
      `INSERT INTO issues (title, content, status, priority) VALUES
        ('I1', 'C', 'triage', 'low'),
        ('I2', 'C', 'triage', 'medium'),
        ('I3', 'C', 'backlog', 'medium'),
        ('I4', 'C', 'backlog', 'urgent'),
        ('I5', 'C', 'in_progress', 'high'),
        ('I6', 'C', 'in_progress', 'high'),
        ('I7', 'C', 'in_progress', 'medium'),
        ('I8', 'C', 'in_review', 'urgent'),
        ('I9', 'C', 'done', 'low'),
        ('I10','C', 'cancelled', 'medium')`
    );
    // Soft-delete the second triage issue
    await testPool.query(`UPDATE issues SET deleted_at = NOW() WHERE title = 'I2'`);

    // Standups: two distinct users today (one duplicate for same user), one old, one deleted
    await testPool.query(
      `INSERT INTO standups (user_id, standup_date, yesterday, today, blockers) VALUES ($1, CURRENT_DATE, 'y', 't', 'b')`,
      [userId1]
    );
    await testPool.query(
      `INSERT INTO standups (user_id, standup_date, yesterday, today, blockers) VALUES ($1, CURRENT_DATE, 'y2', 't2', 'b2')`,
      [userId2]
    );
    // Duplicate for user1 (should not increase distinct count)
    await testPool.query(
      `INSERT INTO standups (user_id, standup_date, yesterday, today, blockers) VALUES ($1, CURRENT_DATE, 'y3', 't3', 'b3')`,
      [userId1]
    );
    // Old standup (not today)
    await testPool.query(
      `INSERT INTO standups (user_id, standup_date, yesterday, today, blockers) VALUES ($1, CURRENT_DATE - INTERVAL '1 day', 'yo', 'to', 'bo')`,
      [userId1]
    );
    // Deleted standup (today)
    await testPool.query(
      `INSERT INTO standups (user_id, standup_date, yesterday, today, blockers, deleted_at) VALUES ($1, CURRENT_DATE, 'yd', 'td', 'bd', NOW())`,
      [userId1]
    );

    // Weeks and pending reviews
    const week = await testPool.query(
      `INSERT INTO weeks (start_date, end_date) VALUES (CURRENT_DATE, CURRENT_DATE + INTERVAL '6 days') RETURNING id`
    );
    const weekId = week.rows[0].id;

    // Weekly plans: 1 submitted (counts), 1 draft (ignored), 1 submitted but deleted (ignored)
    await testPool.query(
      `INSERT INTO weekly_plans (user_id, week_id, plan_content, status) VALUES ($1, $2, 'Plan 1', 'submitted')`,
      [userId1, weekId]
    );
    await testPool.query(
      `INSERT INTO weekly_plans (user_id, week_id, plan_content, status) VALUES ($1, $2, 'Plan 2', 'draft')`,
      [userId2, weekId]
    );
    await testPool.query(
      `INSERT INTO weekly_plans (user_id, week_id, plan_content, status, deleted_at) VALUES ($1, $2, 'Plan 3', 'submitted', NOW())`,
      [userId2, weekId]
    );

    // Weekly retros: 1 submitted (counts), 1 draft (ignored)
    await testPool.query(
      `INSERT INTO weekly_retros (user_id, week_id, went_well, to_improve, action_items, status) VALUES ($1, $2, 'w', 'i', 'a', 'submitted')`,
      [userId1, weekId]
    );
    await testPool.query(
      `INSERT INTO weekly_retros (user_id, week_id, went_well, to_improve, action_items, status) VALUES ($1, $2, 'w2', 'i2', 'a2', 'draft')`,
      [userId2, weekId]
    );
  });

  afterAll(async () => {
    await testPool.query("DROP TABLE IF EXISTS weekly_retros CASCADE");
    await testPool.query("DROP TABLE IF EXISTS weekly_plans CASCADE");
    await testPool.query("DROP TABLE IF EXISTS weeks CASCADE");
    await testPool.query("DROP TABLE IF EXISTS standups CASCADE");
    await testPool.query("DROP TABLE IF EXISTS teams CASCADE");
    await testPool.query("DROP TABLE IF EXISTS projects CASCADE");
    await testPool.query("DROP TABLE IF EXISTS issues CASCADE");
    await testPool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await testPool.query("DROP TABLE IF EXISTS users CASCADE");
    await testPool.end();
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/status-overview");
    expect(res.status).toBe(401);
  });

  it("returns aggregate metrics with correct counts and shapes", async () => {
    const res = await request(app)
      .get("/api/status-overview")
      .set("x-session-token", sessionToken);

    expect(res.status).toBe(200);

    // Shape checks
    expect(res.body).toHaveProperty("issuesByStatus");
    expect(res.body).toHaveProperty("issuesByPriority");
    expect(res.body).toHaveProperty("projectCount");
    expect(res.body).toHaveProperty("teamCount");
    expect(res.body).toHaveProperty("activeUsersToday");
    expect(res.body).toHaveProperty("pendingReviews");

    // Status keys (must include all, even when zero)
    const statuses = [
      "triage",
      "backlog",
      "todo",
      "in_progress",
      "in_review",
      "done",
      "cancelled",
    ];
    for (const s of statuses) {
      expect(res.body.issuesByStatus).toHaveProperty(s);
      expect(typeof res.body.issuesByStatus[s]).toBe("number");
    }

    // Priority keys (must include all, even when zero)
    const priorities = ["low", "medium", "high", "urgent"];
    for (const p of priorities) {
      expect(res.body.issuesByPriority).toHaveProperty(p);
      expect(typeof res.body.issuesByPriority[p]).toBe("number");
    }

    // Concrete expected counts from seeded data
    expect(res.body.issuesByStatus).toMatchObject({
      triage: 1,
      backlog: 2,
      todo: 0,
      in_progress: 3,
      in_review: 1,
      done: 1,
      cancelled: 1,
    });

    expect(res.body.issuesByPriority).toMatchObject({
      low: 2,
      medium: 3,
      high: 2,
      urgent: 2,
    });

    expect(res.body.projectCount).toBe(2); // 3 total - 1 deleted
    expect(res.body.teamCount).toBe(2);
    expect(res.body.activeUsersToday).toBe(2); // two distinct users submitted today
    expect(res.body.pendingReviews).toBe(2); // 1 submitted plan + 1 submitted retro
  });

  it("returns zeros when no data exists", async () => {
    // Clear domain tables (keep users/sessions for auth)
    await testPool.query("DELETE FROM issues");
    await testPool.query("DELETE FROM projects");
    await testPool.query("DELETE FROM teams");
    await testPool.query("DELETE FROM standups");
    await testPool.query("DELETE FROM weekly_plans");
    await testPool.query("DELETE FROM weekly_retros");

    const res = await request(app)
      .get("/api/status-overview")
      .set("x-session-token", sessionToken);

    expect(res.status).toBe(200);

    expect(res.body.issuesByStatus).toMatchObject({
      triage: 0,
      backlog: 0,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
      cancelled: 0,
    });

    expect(res.body.issuesByPriority).toMatchObject({
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    });

    expect(res.body.projectCount).toBe(0);
    expect(res.body.teamCount).toBe(0);
    expect(res.body.activeUsersToday).toBe(0);
    expect(res.body.pendingReviews).toBe(0);
  });
});
