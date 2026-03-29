import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createAuthRouter } from "../routes/auth.js";
import { createSprintReviewsRouter } from "../routes/sprint-reviews.js";

// Test database setup (match pattern from auth.test.ts)
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter(testPool));
app.use("/api/sprint-reviews", createSprintReviewsRouter(testPool));

let sessionToken: string;
let userId: string;
let weekId: string;
let reviewId: string;

describe("Sprint Reviews API", () => {
  beforeAll(async () => {
    // Create required extension and tables. Avoid dropping shared tables.
    await testPool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    // Users + sessions (compatible with auth.test.ts pattern)
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
    // Ensure role column exists for middleware compatibility
    await testPool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'`
    );

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS weeks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        content TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP DEFAULT NULL
      )
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS sprint_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        week_id UUID NOT NULL,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        summary TEXT NOT NULL,
        accomplishments TEXT NOT NULL,
        challenges TEXT NOT NULL,
        next_steps TEXT NOT NULL,
        team_rating INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        submitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP DEFAULT NULL
      )
    `);

    // Register and login a test user
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ username: "sprintuser", email: "sprint@test.com", password: "password123" });
    expect([200, 201]).toContain(registerRes.status);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "sprintuser", password: "password123" });

    expect(loginRes.status).toBe(200);
    sessionToken = loginRes.body.session.session_id;
    userId = loginRes.body.user.id;

    // Create a test week
    const weekRes = await testPool.query(
      "INSERT INTO weeks (title) VALUES ('Test Week') RETURNING id"
    );
    weekId = weekRes.rows[0].id as string;
  });

  afterAll(async () => {
    // Cleanup rows created by this suite, but do not drop shared tables
    try { await testPool.query(`DELETE FROM sprint_reviews WHERE author_id = $1`, [userId]); } catch {}
    try { await testPool.query(`DELETE FROM weeks WHERE title = 'Test Week'`); } catch {}
    try { await testPool.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]); } catch {}
    try { await testPool.query(`DELETE FROM users WHERE username = 'sprintuser'`); } catch {}
    await testPool.end();
  });

  beforeEach(async () => {
    await testPool.query("DELETE FROM sprint_reviews");
  });

  it("GET /api/sprint-reviews without token returns 401", async () => {
    const res = await request(app).get("/api/sprint-reviews");
    expect(res.status).toBe(401);
  });

  it("GET /api/sprint-reviews with token returns empty array", async () => {
    const res = await request(app)
      .get("/api/sprint-reviews")
      .set("x-session-token", sessionToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it("POST /api/sprint-reviews with valid data creates a review (201)", async () => {
    const res = await request(app)
      .post("/api/sprint-reviews")
      .set("x-session-token", sessionToken)
      .send({
        weekId,
        summary: "Great sprint",
        accomplishments: "Shipped core features",
        challenges: "Tight deadlines",
        nextSteps: "Refactor modules",
        teamRating: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.weekId).toBe(weekId);
    expect(res.body.authorId).toBe(userId);
    expect(res.body.status).toBe("draft");
    expect(res.body.teamRating).toBe(5);

    reviewId = res.body.id as string;
  });

  it("GET /api/sprint-reviews returns array with 1 draft review", async () => {
    // Ensure one exists
    const create = await request(app)
      .post("/api/sprint-reviews")
      .set("x-session-token", sessionToken)
      .send({
        weekId,
        summary: "Summary",
        accomplishments: "A",
        challenges: "C",
        nextSteps: "N",
        teamRating: 5,
      });
    expect(create.status).toBe(201);

    const res = await request(app)
      .get("/api/sprint-reviews")
      .set("x-session-token", sessionToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe("draft");
    reviewId = create.body.id as string;
  });

  it("GET /api/sprint-reviews/:id returns the specific review", async () => {
    const create = await request(app)
      .post("/api/sprint-reviews")
      .set("x-session-token", sessionToken)
      .send({
        weekId,
        summary: "Specific",
        accomplishments: "A",
        challenges: "C",
        nextSteps: "N",
        teamRating: 5,
      });
    expect(create.status).toBe(201);

    const res = await request(app)
      .get(`/api/sprint-reviews/${create.body.id}`)
      .set("x-session-token", sessionToken);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(create.body.id);
    expect(res.body.summary).toBe("Specific");
  });

  it("PUT /api/sprint-reviews/:id updates the summary (200)", async () => {
    const create = await request(app)
      .post("/api/sprint-reviews")
      .set("x-session-token", sessionToken)
      .send({
        weekId,
        summary: "Old",
        accomplishments: "A",
        challenges: "C",
        nextSteps: "N",
        teamRating: 5,
      });
    expect(create.status).toBe(201);

    const res = await request(app)
      .put(`/api/sprint-reviews/${create.body.id}`)
      .set("x-session-token", sessionToken)
      .send({ summary: "Updated summary" });

    expect(res.status).toBe(200);
    expect(res.body.summary).toBe("Updated summary");
  });

  it("PATCH /api/sprint-reviews/:id/submit changes status to submitted and sets submittedAt", async () => {
    const create = await request(app)
      .post("/api/sprint-reviews")
      .set("x-session-token", sessionToken)
      .send({
        weekId,
        summary: "To submit",
        accomplishments: "A",
        challenges: "C",
        nextSteps: "N",
        teamRating: 5,
      });
    expect(create.status).toBe(201);

    const res = await request(app)
      .patch(`/api/sprint-reviews/${create.body.id}/submit`)
      .set("x-session-token", sessionToken);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("submitted");
    expect(res.body.submittedAt || res.body.submitted_at).toBeTruthy();
  });

  it("PATCH /api/sprint-reviews/:id/submit on already submitted returns 400", async () => {
    const create = await request(app)
      .post("/api/sprint-reviews")
      .set("x-session-token", sessionToken)
      .send({
        weekId,
        summary: "Already submitted",
        accomplishments: "A",
        challenges: "C",
        nextSteps: "N",
        teamRating: 5,
      });
    expect(create.status).toBe(201);

    const first = await request(app)
      .patch(`/api/sprint-reviews/${create.body.id}/submit`)
      .set("x-session-token", sessionToken);
    expect(first.status).toBe(200);

    const second = await request(app)
      .patch(`/api/sprint-reviews/${create.body.id}/submit`)
      .set("x-session-token", sessionToken);
    expect(second.status).toBe(400);
  });

  it("DELETE /api/sprint-reviews/:id soft deletes the review (200)", async () => {
    const create = await request(app)
      .post("/api/sprint-reviews")
      .set("x-session-token", sessionToken)
      .send({
        weekId,
        summary: "To delete",
        accomplishments: "A",
        challenges: "C",
        nextSteps: "N",
        teamRating: 5,
      });
    expect(create.status).toBe(201);

    const del = await request(app)
      .delete(`/api/sprint-reviews/${create.body.id}`)
      .set("x-session-token", sessionToken);
    expect(del.status).toBe(200);

    // Should not appear in list
    const list = await request(app)
      .get("/api/sprint-reviews")
      .set("x-session-token", sessionToken);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(0);
  });
});
