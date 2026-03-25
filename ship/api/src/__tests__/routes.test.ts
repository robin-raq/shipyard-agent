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
  await pool.query("DELETE FROM documents");
});

async function seedDoc(overrides: Record<string, string> = {}) {
  const defaults = { title: "Test Doc", content: "Content", document_type: "doc" };
  const doc = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO documents (title, content, document_type)
     VALUES ($1, $2, $3) RETURNING *`,
    [doc.title, doc.content, doc.document_type]
  );
  return result.rows[0];
}

describe("GET /api/documents", () => {
  it("returns 200 with array of documents", async () => {
    await seedDoc();
    const res = await request(app).get("/api/documents");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it("filters by document_type", async () => {
    await seedDoc({ document_type: "doc" });
    await seedDoc({ document_type: "issue", title: "Bug" });
    await seedDoc({ document_type: "issue", title: "Feature" });

    const res = await request(app).get("/api/documents?type=issue");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((d: { document_type: string }) => d.document_type === "issue")).toBe(true);
  });

  it("returns 400 for invalid type", async () => {
    const res = await request(app).get("/api/documents?type=invalid");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });

  it("excludes soft-deleted documents", async () => {
    const doc = await seedDoc();
    await pool.query("UPDATE documents SET deleted_at = NOW() WHERE id = $1", [doc.id]);

    const res = await request(app).get("/api/documents");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe("GET /api/documents/:id", () => {
  it("returns 200 with document", async () => {
    const doc = await seedDoc();
    const res = await request(app).get(`/api/documents/${doc.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(doc.id);
    expect(res.body.title).toBe("Test Doc");
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app).get("/api/documents/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });
});

describe("POST /api/documents", () => {
  it("creates document and returns 201", async () => {
    const res = await request(app)
      .post("/api/documents")
      .send({ title: "New Doc", document_type: "project", content: "Hello" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe("New Doc");
    expect(res.body.document_type).toBe("project");
  });

  it("returns 400 when title is missing", async () => {
    const res = await request(app)
      .post("/api/documents")
      .send({ document_type: "doc" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });

  it("returns 400 for invalid document_type", async () => {
    const res = await request(app)
      .post("/api/documents")
      .send({ title: "Bad Type", document_type: "invalid" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });
});

describe("PUT /api/documents/:id", () => {
  it("updates document and returns 200", async () => {
    const doc = await seedDoc();
    const res = await request(app)
      .put(`/api/documents/${doc.id}`)
      .send({ title: "Updated Title" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Title");
    expect(new Date(res.body.updated_at).getTime())
      .toBeGreaterThan(new Date(doc.updated_at).getTime());
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app)
      .put("/api/documents/00000000-0000-0000-0000-000000000000")
      .send({ title: "Nope" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/documents/:id", () => {
  it("soft deletes and returns 200", async () => {
    const doc = await seedDoc();
    const res = await request(app).delete(`/api/documents/${doc.id}`);
    expect(res.status).toBe(200);
  });

  it("GET returns 404 after soft delete", async () => {
    const doc = await seedDoc();
    await request(app).delete(`/api/documents/${doc.id}`);
    const res = await request(app).get(`/api/documents/${doc.id}`);
    expect(res.status).toBe(404);
  });
});
