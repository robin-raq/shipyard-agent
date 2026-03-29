import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createAssociationsRouter } from "../routes/associations.js";

// Test database setup (follow same pattern as auth.test.ts)
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/associations", createAssociationsRouter(testPool));

// Utility to create a user and session
async function createUser({
  username,
  email,
  role = "member",
}: { username: string; email: string; role?: string }) {
  const result = await testPool.query(
    `INSERT INTO users (username, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, role`,
    [username, email, "password-hash", role]
  );
  return result.rows[0] as { id: string; username: string; email: string; role: string };
}

async function createSession(userId: string, sessionId?: string) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 days
  const result = await testPool.query(
    `INSERT INTO sessions (session_id, user_id, expires_at)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3)
     RETURNING session_id`,
    [sessionId || null, userId, expires]
  );
  return result.rows[0].session_id as string;
}

describe("Associations API", () => {
  let user: { id: string; username: string; email: string; role: string };
  let sessionToken: string;

  beforeAll(async () => {
    // Create tables for testing
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'member',
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
      CREATE TABLE IF NOT EXISTS associations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type VARCHAR(20) NOT NULL,
        source_id UUID NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        target_id UUID NOT NULL,
        relationship VARCHAR(20) NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Seed a user and session
    user = await createUser({ username: "assocuser", email: "assoc@example.com", role: "member" });
    sessionToken = await createSession(user.id, "33333333-3333-3333-3333-333333333333");
  });

  afterAll(async () => {
    await testPool.query("DROP TABLE IF EXISTS associations CASCADE");
    await testPool.query("DROP TABLE IF EXISTS sessions CASCADE");
    await testPool.query("DROP TABLE IF EXISTS users CASCADE");
    await testPool.end();
  });

  beforeEach(async () => {
    await testPool.query("DELETE FROM associations");
  });

  describe("Authentication", () => {
    it("should require authentication for listing associations", async () => {
      const res = await request(app).get("/api/associations");
      expect(res.status).toBe(401);
    });

    it("should require authentication for creating associations", async () => {
      const res = await request(app).post("/api/associations").send({});
      expect(res.status).toBe(401);
    });

    it("should require authentication for deleting associations", async () => {
      const res = await request(app).delete("/api/associations/00000000-0000-0000-0000-000000000000");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/associations", () => {
    it("should validate required query params", async () => {
      const res1 = await request(app)
        .get("/api/associations")
        .set("Authorization", `Bearer ${sessionToken}`);
      expect(res1.status).toBe(400);
      expect(res1.body.message).toContain("required");

      const res2 = await request(app)
        .get("/api/associations")
        .query({ entity_type: "issue" })
        .set("Authorization", `Bearer ${sessionToken}`);
      expect(res2.status).toBe(400);

      const res3 = await request(app)
        .get("/api/associations")
        .query({ entity_type: "invalid", entity_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" })
        .set("Authorization", `Bearer ${sessionToken}`);
      expect(res3.status).toBe(400);
      expect(res3.body.message).toContain("Invalid entity_type");
    });

    it("should return empty list when no associations exist", async () => {
      const res = await request(app)
        .get("/api/associations")
        .query({ entity_type: "issue", entity_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" })
        .set("Authorization", `Bearer ${sessionToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });

  describe("POST /api/associations", () => {
    const ISSUE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const PROJECT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    it("should create an association (snake_case body)", async () => {
      const res = await request(app)
        .post("/api/associations")
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({
          source_type: "issue",
          source_id: ISSUE_A,
          target_type: "project",
          target_id: PROJECT_B,
          relationship: "related",
        });

      expect(res.status).toBe(201);
      const assoc = res.body;
      expect(assoc).toHaveProperty("id");
      expect(assoc.sourceType).toBe("issue");
      expect(assoc.sourceId).toBe(ISSUE_A);
      expect(assoc.targetType).toBe("project");
      expect(assoc.targetId).toBe(PROJECT_B);
      expect(assoc.relationship).toBe("related");
      expect(assoc.createdBy).toBe(user.id);
      expect(new Date(assoc.createdAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("should accept camelCase body as well", async () => {
      const res = await request(app)
        .post("/api/associations")
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({
          sourceType: "issue",
          sourceId: ISSUE_A,
          targetType: "project",
          targetId: PROJECT_B,
          relationship: "blocks",
        });

      expect(res.status).toBe(201);
      expect(res.body.relationship).toBe("blocks");
    });

    it("should reject invalid entity types", async () => {
      const res = await request(app)
        .post("/api/associations")
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({
          source_type: "invalid",
          source_id: ISSUE_A,
          target_type: "project",
          target_id: PROJECT_B,
          relationship: "related",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid source_type or target_type");
    });

    it("should reject invalid relationship", async () => {
      const res = await request(app)
        .post("/api/associations")
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({
          source_type: "issue",
          source_id: ISSUE_A,
          target_type: "project",
          target_id: PROJECT_B,
          relationship: "unknown",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid relationship");
    });

    it("should prevent exact duplicate associations", async () => {
      const payload = {
        source_type: "issue",
        source_id: ISSUE_A,
        target_type: "project",
        target_id: PROJECT_B,
        relationship: "related",
      } as const;

      const first = await request(app)
        .post("/api/associations")
        .set("Authorization", `Bearer ${sessionToken}`)
        .send(payload);
      expect(first.status).toBe(201);

      const second = await request(app)
        .post("/api/associations")
        .set("Authorization", `Bearer ${sessionToken}`)
        .send(payload);
      expect(second.status).toBe(409);
      expect(second.body.message).toContain("already exists");
    });
  });

  describe("Listing associations involving an entity", () => {
    const ISSUE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const PROJECT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const DOC_C = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    it("should return associations where the entity is source or target", async () => {
      // Create two associations around ISSUE_A
      const a1 = await request(app)
        .post("/api/associations")
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({
          source_type: "issue",
          source_id: ISSUE_A,
          target_type: "project",
          target_id: PROJECT_B,
          relationship: "related",
        });
      expect(a1.status).toBe(201);

      const a2 = await request(app)
        .post("/api/associations")
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({
          source_type: "document",
          source_id: DOC_C,
          target_type: "issue",
          target_id: ISSUE_A,
          relationship: "blocks",
        });
      expect(a2.status).toBe(201);

      const list = await request(app)
        .get("/api/associations")
        .query({ entity_type: "issue", entity_id: ISSUE_A })
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(list.status).toBe(200);
      expect(Array.isArray(list.body)).toBe(true);
      expect(list.body.length).toBe(2);

      const hasRelated = list.body.some((r: any) => r.relationship === "related" && r.targetId === PROJECT_B);
      const hasBlocks = list.body.some((r: any) => r.relationship === "blocks" && r.sourceId === DOC_C);
      expect(hasRelated).toBe(true);
      expect(hasBlocks).toBe(true);
    });
  });

  describe("DELETE /api/associations/:id", () => {
    const ISSUE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const PROJECT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    it("should delete an existing association", async () => {
      const create = await request(app)
        .post("/api/associations")
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({
          source_type: "issue",
          source_id: ISSUE_A,
          target_type: "project",
          target_id: PROJECT_B,
          relationship: "related",
        });
      expect(create.status).toBe(201);
      const id = create.body.id as string;

      const del = await request(app)
        .delete(`/api/associations/${id}`)
        .set("Authorization", `Bearer ${sessionToken}`);
      expect(del.status).toBe(200);
      expect(del.body).toEqual({ ok: true });

      const delAgain = await request(app)
        .delete(`/api/associations/${id}`)
        .set("Authorization", `Bearer ${sessionToken}`);
      expect(delAgain.status).toBe(404);
    });
  });
});
