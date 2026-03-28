import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createIssuesRouter } from "../routes/issues.js";

// Test database setup
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/issues", createIssuesRouter(testPool));

describe("Issues Kanban API", () => {
  beforeAll(async () => {
    // Create tables for testing
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS issues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'open',
        assignee_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterAll(async () => {
    // Clean up test data
    await testPool.query("DROP TABLE IF EXISTS issues CASCADE");
    await testPool.end();
  });

  describe("POST /api/issues", () => {
    it("should create a new issue with default status and no assignee", async () => {
      const response = await request(app)
        .post("/api/issues")
        .send({
          title: "New Issue",
          description: "This is a test issue."
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body.status).toBe("open");
      expect(response.body.assignee_id).toBeNull();
    });

    it("should create a new issue with specified status and assignee", async () => {
      const response = await request(app)
        .post("/api/issues")
        .send({
          title: "Assigned Issue",
          description: "This issue is assigned.",
          status: "review",
          assignee_id: "123e4567-e89b-12d3-a456-426614174000"
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("review");
      expect(response.body.assignee_id).toBe("123e4567-e89b-12d3-a456-426614174000");
    });
  });

  describe("PATCH /api/issues/:id/status", () => {
    let issueId: string;

    beforeAll(async () => {
      const response = await request(app)
        .post("/api/issues")
        .send({
          title: "Status Update Issue",
          description: "This issue will have its status updated."
        });
      issueId = response.body.id;
    });

    it("should update the status of an issue", async () => {
      const response = await request(app)
        .patch(`/api/issues/${issueId}/status`)
        .send({ status: "blocked" });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("blocked");
    });

    it("should reject invalid status update", async () => {
      const response = await request(app)
        .patch(`/api/issues/${issueId}/status`)
        .send({ status: "invalid-status" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Invalid status");
    });
  });

  describe("GET /api/issues", () => {
    it("should filter issues by assignee_id", async () => {
      const response = await request(app)
        .get("/api/issues?assignee_id=123e4567-e89b-12d3-a456-426614174000");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((issue: any) => {
        expect(issue.assignee_id).toBe("123e4567-e89b-12d3-a456-426614174000");
      });
    });
  });
});
