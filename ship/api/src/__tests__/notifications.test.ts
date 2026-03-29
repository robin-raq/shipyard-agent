import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createNotificationsRouter } from "../routes/notifications.js";
import { createAuthRouter } from "../routes/auth.js";

// Test database setup (match auth.test.ts pattern)
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter(testPool));
app.use("/api/notifications", createNotificationsRouter(testPool));

describe("Notifications API", () => {
  let sessionToken: string;
  let userId: string;
  let notificationId: string;

  beforeAll(async () => {
    // Create tables for testing (same style as auth.test.ts)
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

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        type VARCHAR(30) NOT NULL CHECK (type IN ('assignment', 'comment', 'review_request', 'review_decision', 'mention', 'status_change')),
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        entity_type VARCHAR(30),
        entity_id UUID,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Register a test user and login to get a session token
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        username: "notifuser",
        email: "notifuser@example.com",
        password: "password123",
      });

    expect(registerResponse.status).toBe(201);
    sessionToken = registerResponse.body.session.session_id;
    userId = registerResponse.body.user.id;
  });

  afterAll(async () => {
    // Clean up tables
    await testPool.query("DROP TABLE IF EXISTS notifications CASCADE");
    await testPool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await testPool.query("DROP TABLE IF EXISTS users CASCADE");
    await testPool.end();
  });

  it("GET /api/notifications without token should return 401", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("GET /api/notifications with token should return empty list and unread_count 0", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("notifications");
    expect(res.body).toHaveProperty("unread_count");
    expect(Array.isArray(res.body.notifications)).toBe(true);
    expect(res.body.notifications.length).toBe(0);
    expect(res.body.unread_count).toBe(0);
  });

  it("POST /api/notifications should create a notification", async () => {
    const res = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({
        // Use route's required fields
        type: "comment",
        title: "Test Notification",
        body: "This is a test notification.",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("userId", userId);
    expect(res.body).toHaveProperty("type", "comment");
    expect(res.body).toHaveProperty("title", "Test Notification");
    expect(res.body).toHaveProperty("body", "This is a test notification.");
    expect(res.body).toHaveProperty("readAt", null);
    expect(res.body).toHaveProperty("createdAt");

    notificationId = res.body.id;
  });

  it("GET /api/notifications should return the created notification", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
    expect(res.body.notifications.length).toBe(1);

    const n = res.body.notifications[0];
    expect(n.id).toBe(notificationId);
    expect(n.userId).toBe(userId);
    expect(n.title).toBe("Test Notification");
    expect(n.body).toBe("This is a test notification.");
    expect(n.readAt).toBeNull();
  });

  it("GET /api/notifications/unread-count should return { count: 1 }", async () => {
    const res = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("count", 1);
  });

  it("PATCH /api/notifications/:id/read should mark as read", async () => {
    const res = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
  });

  it("GET /api/notifications/unread-count after read should return { count: 0 }", async () => {
    const res = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("count", 0);
  });

  it("PATCH /api/notifications/read-all should mark all as read", async () => {
    // Create another unread notification first
    const createRes = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ type: "comment", title: "Another", body: "Another message" });

    expect(createRes.status).toBe(201);

    const res = await request(app)
      .patch("/api/notifications/read-all")
      .set("Authorization", `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);

    const countRes = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${sessionToken}`);

    expect(countRes.status).toBe(200);
    expect(countRes.body).toHaveProperty("count", 0);
  });

  it("GET /api/notifications?unread_only=true should return only unread (none after read-all)", async () => {
    const res = await request(app)
      .get("/api/notifications?unread_only=true")
      .set("Authorization", `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
    // After read-all, there should be no unread notifications
    expect(res.body.notifications.length).toBe(0);
  });
});
