import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import pg from "pg";
import { runMigrations } from "../db/migrate.js";
import { createApp } from "../app.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://ship:ship@localhost:5433/ship_test";

let pool: pg.Pool;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  await runMigrations(pool);
  app = createApp(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  // Clean up all tables
  await pool.query("DELETE FROM docs");
  await pool.query("DELETE FROM issues");
  await pool.query("DELETE FROM projects");
});

describe("GET /api/search - Unified Search Endpoint", () => {
  describe("Validation", () => {
    it("should return 400 if search query is missing", async () => {
      const res = await request(app).get("/api/search");
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("required");
    });

    it("should return 400 if search query is empty", async () => {
      const res = await request(app).get("/api/search?q=");
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("required");
    });

    it("should return 400 if type parameter is invalid", async () => {
      const res = await request(app).get("/api/search?q=test&type=invalid");
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid type");
    });
  });

  describe("Case-Insensitive Search", () => {
    beforeEach(async () => {
      // Create test data with mixed case
      await pool.query(
        `INSERT INTO docs (title, content) VALUES ($1, $2)`,
        ["UPPERCASE Title", "lowercase content with SEARCHABLE keyword"]
      );
      await pool.query(
        `INSERT INTO issues (title, content, status, priority) VALUES ($1, $2, $3, $4)`,
        ["MixedCase Issue", "Content with SEARCHABLE keyword", "open", "medium"]
      );
      await pool.query(
        `INSERT INTO projects (title, description, status) VALUES ($1, $2, $3)`,
        ["lowercase project", "Description with SEARCHABLE keyword", "active"]
      );
    });

    it("should find results with lowercase query", async () => {
      const res = await request(app).get("/api/search?q=searchable");
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThan(0);
      expect(res.body.results.length).toBeGreaterThan(0);
    });

    it("should find results with uppercase query", async () => {
      const res = await request(app).get("/api/search?q=SEARCHABLE");
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThan(0);
      expect(res.body.results.length).toBeGreaterThan(0);
    });

    it("should find results with mixed case query", async () => {
      const res = await request(app).get("/api/search?q=SeArChAbLe");
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThan(0);
      expect(res.body.results.length).toBeGreaterThan(0);
    });

    it("should return same results regardless of query case", async () => {
      const res1 = await request(app).get("/api/search?q=searchable");
      const res2 = await request(app).get("/api/search?q=SEARCHABLE");
      const res3 = await request(app).get("/api/search?q=SeArChAbLe");

      expect(res1.body.count).toBe(res2.body.count);
      expect(res2.body.count).toBe(res3.body.count);
    });
  });

  describe("Search by Type", () => {
    beforeEach(async () => {
      await pool.query(
        `INSERT INTO docs (title, content) VALUES ($1, $2)`,
        ["Test Doc", "Document with keyword"]
      );
      await pool.query(
        `INSERT INTO issues (title, content, status, priority) VALUES ($1, $2, $3, $4)`,
        ["Test Issue", "Issue with keyword", "open", "medium"]
      );
      await pool.query(
        `INSERT INTO projects (title, description, status) VALUES ($1, $2, $3)`,
        ["Test Project", "Project with keyword", "active"]
      );
    });

    it("should search all types by default", async () => {
      const res = await request(app).get("/api/search?q=keyword");
      expect(res.status).toBe(200);
      expect(res.body.type).toBe("all");
      expect(res.body.count).toBe(3);
      
      const types = res.body.results.map((r: any) => r.type);
      expect(types).toContain("document");
      expect(types).toContain("issue");
      expect(types).toContain("project");
    });

    it("should filter by type=document", async () => {
      const res = await request(app).get("/api/search?q=keyword&type=document");
      expect(res.status).toBe(200);
      expect(res.body.type).toBe("document");
      expect(res.body.count).toBe(1);
      expect(res.body.results[0].type).toBe("document");
    });

    it("should filter by type=issue", async () => {
      const res = await request(app).get("/api/search?q=keyword&type=issue");
      expect(res.status).toBe(200);
      expect(res.body.type).toBe("issue");
      expect(res.body.count).toBe(1);
      expect(res.body.results[0].type).toBe("issue");
    });

    it("should filter by type=project", async () => {
      const res = await request(app).get("/api/search?q=keyword&type=project");
      expect(res.status).toBe(200);
      expect(res.body.type).toBe("project");
      expect(res.body.count).toBe(1);
      expect(res.body.results[0].type).toBe("project");
    });
  });

  describe("Search in Title and Content", () => {
    it("should find documents by title", async () => {
      await pool.query(
        `INSERT INTO docs (title, content) VALUES ($1, $2)`,
        ["Unique Title Keyword", "Regular content"]
      );

      const res = await request(app).get("/api/search?q=unique");
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThan(0);
      expect(res.body.results[0].title).toContain("Unique");
    });

    it("should find documents by content", async () => {
      await pool.query(
        `INSERT INTO docs (title, content) VALUES ($1, $2)`,
        ["Regular Title", "Content with unique keyword"]
      );

      const res = await request(app).get("/api/search?q=unique");
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThan(0);
      expect(res.body.results[0].content).toContain("unique");
    });

    it("should find issues by title", async () => {
      await pool.query(
        `INSERT INTO issues (title, content, status, priority) VALUES ($1, $2, $3, $4)`,
        ["Unique Issue Title", "Regular content", "open", "medium"]
      );

      const res = await request(app).get("/api/search?q=unique&type=issue");
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThan(0);
    });

    it("should find projects by description", async () => {
      await pool.query(
        `INSERT INTO projects (title, description, status) VALUES ($1, $2, $3)`,
        ["Regular Project", "Description with unique keyword", "active"]
      );

      const res = await request(app).get("/api/search?q=unique&type=project");
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThan(0);
    });
  });

  describe("Soft Delete Handling", () => {
    it("should exclude soft-deleted documents from search", async () => {
      const result = await pool.query(
        `INSERT INTO docs (title, content) VALUES ($1, $2) RETURNING id`,
        ["Deleted Doc", "Content with keyword"]
      );
      const docId = result.rows[0].id;

      // Soft delete the document
      await pool.query(
        `UPDATE docs SET deleted_at = NOW() WHERE id = $1`,
        [docId]
      );

      const res = await request(app).get("/api/search?q=keyword&type=document");
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });

    it("should exclude soft-deleted issues from search", async () => {
      const result = await pool.query(
        `INSERT INTO issues (title, content, status, priority) VALUES ($1, $2, $3, $4) RETURNING id`,
        ["Deleted Issue", "Content with keyword", "open", "medium"]
      );
      const issueId = result.rows[0].id;

      await pool.query(
        `UPDATE issues SET deleted_at = NOW() WHERE id = $1`,
        [issueId]
      );

      const res = await request(app).get("/api/search?q=keyword&type=issue");
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });

    it("should exclude soft-deleted projects from search", async () => {
      const result = await pool.query(
        `INSERT INTO projects (title, description, status) VALUES ($1, $2, $3) RETURNING id`,
        ["Deleted Project", "Description with keyword", "active"]
      );
      const projectId = result.rows[0].id;

      await pool.query(
        `UPDATE projects SET deleted_at = NOW() WHERE id = $1`,
        [projectId]
      );

      const res = await request(app).get("/api/search?q=keyword&type=project");
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  describe("Response Format", () => {
    beforeEach(async () => {
      await pool.query(
        `INSERT INTO docs (title, content) VALUES ($1, $2)`,
        ["Test Doc", "Content"]
      );
    });

    it("should return proper response structure", async () => {
      const res = await request(app).get("/api/search?q=test");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("query");
      expect(res.body).toHaveProperty("type");
      expect(res.body).toHaveProperty("count");
      expect(res.body).toHaveProperty("results");
      expect(Array.isArray(res.body.results)).toBe(true);
    });

    it("should include metadata in response", async () => {
      const res = await request(app).get("/api/search?q=test&type=document");
      expect(res.body.query).toBe("test");
      expect(res.body.type).toBe("document");
      expect(res.body.count).toBe(res.body.results.length);
    });

    it("should return empty results for non-matching query", async () => {
      const res = await request(app).get("/api/search?q=nonexistentquery123");
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.results).toEqual([]);
    });
  });

  describe("Result Ordering", () => {
    it("should order results by updated_at DESC", async () => {
      // Insert documents with different timestamps
      await pool.query(
        `INSERT INTO docs (title, content, updated_at) VALUES ($1, $2, $3)`,
        ["Old Doc", "keyword", new Date("2023-01-01")]
      );
      await pool.query(
        `INSERT INTO docs (title, content, updated_at) VALUES ($1, $2, $3)`,
        ["New Doc", "keyword", new Date("2024-01-01")]
      );

      const res = await request(app).get("/api/search?q=keyword&type=document");
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      
      // First result should be the newer one
      const dates = res.body.results.map((r: any) => new Date(r.updated_at).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });
  });

  describe("Special Characters", () => {
    it("should handle special characters in search query", async () => {
      await pool.query(
        `INSERT INTO docs (title, content) VALUES ($1, $2)`,
        ["Test & Special", "Content"]
      );

      const res = await request(app).get("/api/search?q=" + encodeURIComponent("special"));
      expect(res.status).toBe(200);
    });

    it("should handle URL-encoded search queries", async () => {
      await pool.query(
        `INSERT INTO docs (title, content) VALUES ($1, $2)`,
        ["Test Document", "Multi word content"]
      );

      const res = await request(app).get("/api/search?q=" + encodeURIComponent("multi word"));
      expect(res.status).toBe(200);
    });
  });
});
