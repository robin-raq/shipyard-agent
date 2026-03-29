import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createOrgChartRouter } from "../routes/org-chart.js";

// Test database setup
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/org-chart", createOrgChartRouter(testPool));

describe("Org Chart API", () => {
  let managerId: string;
  let report1Id: string;
  let report2Id: string;
  let sessionToken: string;

  beforeAll(async () => {
    // Create required tables for testing
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        title VARCHAR(255),
        department VARCHAR(255),
        reports_to UUID REFERENCES users(id) ON DELETE SET NULL,
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

    // Insert 3 users: one manager, two reports
    const mgrRes = await testPool.query(
      `INSERT INTO users (username, email, role, title, department, reports_to)
       VALUES ($1, $2, 'user', $3, $4, NULL)
       RETURNING id`,
      [
        "manager1",
        "manager1@example.com",
        "Engineering Manager",
        "Engineering",
      ]
    );
    managerId = mgrRes.rows[0].id;

    const r1Res = await testPool.query(
      `INSERT INTO users (username, email, role, title, department, reports_to)
       VALUES ($1, $2, 'user', $3, $4, $5)
       RETURNING id`,
      [
        "dev1",
        "dev1@example.com",
        "Software Engineer",
        "Engineering",
        managerId,
      ]
    );
    report1Id = r1Res.rows[0].id;

    const r2Res = await testPool.query(
      `INSERT INTO users (username, email, role, title, department, reports_to)
       VALUES ($1, $2, 'user', $3, $4, $5)
       RETURNING id`,
      [
        "dev2",
        "dev2@example.com",
        "Software Engineer",
        "Engineering",
        managerId,
      ]
    );
    report2Id = r2Res.rows[0].id;

    // Create a valid session token for the manager
    const sessRes = await testPool.query(
      `INSERT INTO sessions (user_id, expires_at)
       VALUES ($1, NOW() + INTERVAL '7 days')
       RETURNING session_id`,
      [managerId]
    );
    sessionToken = sessRes.rows[0].session_id;
  });

  afterAll(async () => {
    // Clean up test data
    await testPool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await testPool.query("DROP TABLE IF EXISTS users CASCADE");
    await testPool.end();
  });

  describe("GET /api/org-chart", () => {
    it("should require authentication (401) when no token provided", async () => {
      const res = await request(app).get("/api/org-chart");
      expect(res.status).toBe(401);
    });

    it("should return org chart structure with authentication", async () => {
      const res = await request(app)
        .get("/api/org-chart")
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("tree");
      expect(res.body).toHaveProperty("departments");
      expect(Array.isArray(res.body.tree)).toBe(true);
      expect(Array.isArray(res.body.departments)).toBe(true);
    });

    it("should return a proper tree when users have reports_to set", async () => {
      const res = await request(app)
        .get("/api/org-chart")
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      const tree = res.body.tree as any[];
      const departments = res.body.departments as any[];

      // One root (the manager)
      expect(tree.length).toBe(1);
      expect(tree[0].id).toBe(managerId);
      // Two direct reports under manager
      expect(Array.isArray(tree[0].children)).toBe(true);
      expect(tree[0].children.length).toBe(2);
      const childIds = tree[0].children.map((c: any) => c.id).sort();
      expect(childIds).toEqual([report1Id, report2Id].sort());
      // Departments should include Engineering
      expect(departments).toContain("Engineering");
    });
  });

  describe("GET /api/org-chart/user/:id", () => {
    it("should return user with manager and direct_reports", async () => {
      const res = await request(app)
        .get(`/api/org-chart/user/${report1Id}`)
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.id).toBe(report1Id);
      expect(res.body).toHaveProperty("manager");
      expect(res.body.manager).toBeTruthy();
      expect(res.body.manager.id).toBe(managerId);
      expect(res.body).toHaveProperty("direct_reports");
      expect(Array.isArray(res.body.direct_reports)).toBe(true);
      expect(res.body.direct_reports.length).toBe(0);
    });

    it("should return 404 for non-existent user", async () => {
      // Valid v4 UUID with variant 8 that is very unlikely to exist
      const nonexistentId = "11111111-1111-4111-8111-111111111111";
      const res = await request(app)
        .get(`/api/org-chart/user/${nonexistentId}`)
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/org-chart/user/:id", () => {
    it("should update user's title and department", async () => {
      const res = await request(app)
        .put(`/api/org-chart/user/${report2Id}`)
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({ title: "Senior Engineer", department: "Platform" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.id).toBe(report2Id);
      expect(res.body.user.title).toBe("Senior Engineer");
      expect(res.body.user.department).toBe("Platform");
    });

    it("should handle reports_to being self gracefully (400)", async () => {
      const res = await request(app)
        .put(`/api/org-chart/user/${managerId}`)
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({ reports_to: managerId });

      expect(res.status).toBe(400);
    });
  });
});
