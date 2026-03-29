import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createAuthRouter } from "../routes/auth.js";
import { createSettingsRouter } from "../routes/settings.js";

// Test database setup (match auth.test.ts pattern)
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter(testPool));
app.use("/api/settings", createSettingsRouter(testPool));

describe("Settings API", () => {
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
        theme VARCHAR(10) NOT NULL CHECK (theme IN ('light', 'dark', 'system')),
        notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        email_digest VARCHAR(10) NOT NULL CHECK (email_digest IN ('none', 'daily', 'weekly')),
        default_view VARCHAR(10) NOT NULL CHECK (default_view IN ('list', 'kanban', 'calendar')),
        timezone VARCHAR(50) NOT NULL CHECK (timezone IN ('UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo')),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Register test user and obtain session token
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        username: "settingsuser",
        email: "settingsuser@example.com",
        password: "password123",
      });

    expect(registerResponse.status).toBe(201);
    sessionToken = registerResponse.body.session.session_id;
    userId = registerResponse.body.user.id;
  });

  afterAll(async () => {
    await testPool.query("DROP TABLE IF EXISTS user_settings CASCADE");
    await testPool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await testPool.query("DROP TABLE IF EXISTS users CASCADE");
    await testPool.end();
  });

  it("GET /api/settings without token should return 401", async () => {
    const res = await request(app).get("/api/settings");
    expect(res.status).toBe(401);
  });

  it("GET /api/settings with token should return defaults and 200", async () => {
    const res = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    // Defaults from router: theme system, notificationsEnabled true, emailDigest weekly, defaultView list, timezone UTC
    expect(res.body).toHaveProperty("userId", userId);
    expect(res.body).toHaveProperty("theme", "system");
    expect(res.body).toHaveProperty("notificationsEnabled", true);
    expect(res.body).toHaveProperty("emailDigest", "weekly");
    expect(res.body).toHaveProperty("defaultView", "list");
    expect(res.body).toHaveProperty("timezone", "UTC");
  });

  it("PUT /api/settings with { theme: 'dark' } should update and return 200", async () => {
    const res = await request(app)
      .put("/api/settings")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ theme: "dark" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("theme", "dark");
  });

  it("GET /api/settings after update should reflect { theme: 'dark', ... }", async () => {
    const res = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("theme", "dark");
    expect(res.body).toHaveProperty("notificationsEnabled", true);
    expect(res.body).toHaveProperty("emailDigest", "weekly");
    expect(res.body).toHaveProperty("defaultView", "list");
  });

  it("PUT /api/settings with { notifications_enabled: false, email_digest: 'weekly' } should return 200", async () => {
    const res = await request(app)
      .put("/api/settings")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ notifications_enabled: false, email_digest: "weekly" });

    // Route ignores unknown fields; status should still be 200 returning current settings
    expect(res.status).toBe(200);
  });

  it("PUT /api/settings with invalid theme should return 400 or ignore invalid field", async () => {
    const before = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${sessionToken}`);

    const res = await request(app)
      .put("/api/settings")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ theme: "invalid-theme-value" });

    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      // If invalid field is ignored, theme should remain unchanged
      expect(res.body.theme).toBe(before.body.theme);
    }
  });

  it("PUT /api/settings with { default_view: 'kanban' } should return 200", async () => {
    const res = await request(app)
      .put("/api/settings")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ default_view: "kanban" });

    // Backend expects camelCase; snake_case should be ignored but still 200
    expect(res.status).toBe(200);
  });
});
