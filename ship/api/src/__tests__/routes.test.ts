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
  await pool.query("DELETE FROM docs");
});

async function seedDoc(overrides: Record<string, string> = {}) {
  const defaults = { title: "Test Doc", content: "Content" };
  const doc = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO docs (title, content)
     VALUES ($1, $2) RETURNING *`,
    [doc.title, doc.content]
  );
  return result.rows[0];
}

describe("GET /api/docs", () => {
  it("returns 200 with array of docs", async () => {
    await seedDoc();
    const res = await request(app).get("/api/docs");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it("filters by title search", async () => {
    await seedDoc({ title: "Meeting Notes" });
    await seedDoc({ title: "Project Plan" });
    await seedDoc({ title: "Meeting Agenda" });

    const res = await request(app).get("/api/docs?search=Meeting");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((d: { title: string }) => d.title.includes("Meeting"))).toBe(true);
  });

  it("excludes soft-deleted docs", async () => {
    const doc = await seedDoc();
    await pool.query("UPDATE docs SET deleted_at = NOW() WHERE id = $1", [doc.id]);

    const res = await request(app).get("/api/docs");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe("GET /api/docs/:id", () => {
  it("returns 200 with doc", async () => {
    const doc = await seedDoc();
    const res = await request(app).get(`/api/docs/${doc.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(doc.id);
    expect(res.body.title).toBe("Test Doc");
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app).get("/api/docs/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });
});

describe("POST /api/docs", () => {
  it("creates doc and returns 201", async () => {
    const res = await request(app)
      .post("/api/docs")
      .send({ title: "New Doc", content: "Hello" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe("New Doc");
    expect(res.body.content).toBe("Hello");
  });

  it("returns 400 when title is missing", async () => {
    const res = await request(app)
      .post("/api/docs")
      .send({ content: "Content without title" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });

  it("returns 400 when content is missing", async () => {
    const res = await request(app)
      .post("/api/docs")
      .send({ title: "Title without content" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });
});

describe("PUT /api/docs/:id", () => {
  it("updates doc and returns 200", async () => {
    const doc = await seedDoc();
    const res = await request(app)
      .put(`/api/docs/${doc.id}`)
      .send({ title: "Updated Title" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Title");
    expect(new Date(res.body.updated_at).getTime())
      .toBeGreaterThan(new Date(doc.updated_at).getTime());
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app)
      .put("/api/docs/00000000-0000-0000-0000-000000000000")
      .send({ title: "Nope" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/docs/:id", () => {
  it("soft deletes and returns 200", async () => {
    const doc = await seedDoc();
    const res = await request(app).delete(`/api/docs/${doc.id}`);
    expect(res.status).toBe(200);
  });

  it("GET returns 404 after soft delete", async () => {
    const doc = await seedDoc();
    await request(app).delete(`/api/docs/${doc.id}`);
    const res = await request(app).get(`/api/docs/${doc.id}`);
    expect(res.status).toBe(404);
  });
});
