import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createStandupsRouter } from "../routes/standups.js";

// Test database setup
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/standups", createStandupsRouter(testPool));

describe("Standups API", () => {
  beforeAll(async () => {
    // Create tables for testing
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS standups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        date DATE NOT NULL,
        yesterday TEXT,
        today TEXT,
        blockers TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  });

  afterAll(async () => {
    // Clean up test data
    await testPool.query("DROP TABLE IF EXISTS standups CASCADE");
    await testPool.end();
  });

  describe("GET /api/standups", () => {
    it("should retrieve all standups for the authenticated user", async () => {
      // Assuming authentication middleware adds user_id to request
      const response = await request(app)
        .get("/api/standups")
        .set("Authorization", "Bearer valid-session-token");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("POST /api/standups", () => {
    it("should create a new standup entry", async () => {
      const response = await request(app)
        .post("/api/standups")
        .set("Authorization", "Bearer valid-session-token")
        .send({
          date: "2023-10-10",
          yesterday: "Worked on API",
          today: "Continue API work",
          blockers: "None",
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
    });
  });

  describe("PUT /api/standups/:id", () => {
    it("should update an existing standup entry", async () => {
      const standupId = "existing-standup-id";
      const response = await request(app)
        .put(`/api/standups/${standupId}`)
        .set("Authorization", "Bearer valid-session-token")
        .send({
          today: "Updated work plan",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id", standupId);
    });
  });

  describe("DELETE /api/standups/:id", () => {
    it("should delete a standup entry", async () => {
      const standupId = "existing-standup-id";
      const response = await request(app)
        .delete(`/api/standups/${standupId}`)
        .set("Authorization", "Bearer valid-session-token");

      expect(response.status).toBe(200);
    });
  });
});
