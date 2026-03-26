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
  
  // Drop all tables to ensure clean state
  await pool.query(`
    DROP TABLE IF EXISTS documents CASCADE;
    DROP TABLE IF EXISTS docs CASCADE;
    DROP TABLE IF EXISTS issues CASCADE;
    DROP TABLE IF EXISTS projects CASCADE;
    DROP TABLE IF EXISTS weeks CASCADE;
    DROP TABLE IF EXISTS teams CASCADE;
    DROP TABLE IF EXISTS ships CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS sessions CASCADE;
    DROP TABLE IF EXISTS comments CASCADE;
    DROP TABLE IF EXISTS programs CASCADE;
    DROP TABLE IF EXISTS program_members CASCADE;
  `);
  
  await runMigrations(pool);
  app = createApp(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await pool.query("DELETE FROM documents");
});

async function seedDocument(overrides: Record<string, any> = {}) {
  const defaults = {
    title: "Test Document",
    content: "Test content",
    document_type: "doc",
  };
  const doc = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO documents (title, content, document_type)
     VALUES ($1, $2, $3) RETURNING *`,
    [doc.title, doc.content, doc.document_type]
  );
  return result.rows[0];
}

describe("Unified Document Model - GET /api/documents", () => {
  it("returns 200 with empty array when no documents exist", async () => {
    const res = await request(app).get("/api/documents");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it("returns all documents across all types", async () => {
    await seedDocument({ title: "Doc 1", document_type: "doc" });
    await seedDocument({ title: "Issue 1", document_type: "issue" });
    await seedDocument({ title: "Project 1", document_type: "project" });
    await seedDocument({ title: "Week 1", document_type: "week" });
    await seedDocument({ title: "Team 1", document_type: "team" });

    const res = await request(app).get("/api/documents");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
  });

  it("filters by document_type=doc", async () => {
    await seedDocument({ title: "Doc 1", document_type: "doc" });
    await seedDocument({ title: "Issue 1", document_type: "issue" });
    await seedDocument({ title: "Doc 2", document_type: "doc" });

    const res = await request(app).get("/api/documents?type=doc");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((d: any) => d.document_type === "doc")).toBe(true);
  });

  it("filters by document_type=issue", async () => {
    await seedDocument({ title: "Doc 1", document_type: "doc" });
    await seedDocument({ title: "Issue 1", document_type: "issue" });
    await seedDocument({ title: "Issue 2", document_type: "issue" });

    const res = await request(app).get("/api/documents?type=issue");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((d: any) => d.document_type === "issue")).toBe(true);
  });

  it("filters by document_type=project", async () => {
    await seedDocument({ title: "Project 1", document_type: "project" });
    await seedDocument({ title: "Doc 1", document_type: "doc" });

    const res = await request(app).get("/api/documents?type=project");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].document_type).toBe("project");
  });

  it("filters by document_type=week", async () => {
    await seedDocument({ title: "Week 1", document_type: "week" });
    await seedDocument({ title: "Week 2", document_type: "week" });

    const res = await request(app).get("/api/documents?type=week");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((d: any) => d.document_type === "week")).toBe(true);
  });

  it("filters by document_type=team", async () => {
    await seedDocument({ title: "Team 1", document_type: "team" });
    await seedDocument({ title: "Doc 1", document_type: "doc" });

    const res = await request(app).get("/api/documents?type=team");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].document_type).toBe("team");
  });

  it("returns 400 for invalid document type", async () => {
    const res = await request(app).get("/api/documents?type=invalid");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Invalid document type");
  });

  it("excludes soft-deleted documents", async () => {
    const doc1 = await seedDocument({ title: "Active Doc" });
    const doc2 = await seedDocument({ title: "Deleted Doc" });
    await pool.query("UPDATE documents SET deleted_at = NOW() WHERE id = $1", [
      doc2.id,
    ]);

    const res = await request(app).get("/api/documents");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(doc1.id);
  });

  it("returns documents ordered by created_at DESC", async () => {
    const doc1 = await seedDocument({ title: "First" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const doc2 = await seedDocument({ title: "Second" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const doc3 = await seedDocument({ title: "Third" });

    const res = await request(app).get("/api/documents");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].id).toBe(doc3.id);
    expect(res.body[1].id).toBe(doc2.id);
    expect(res.body[2].id).toBe(doc1.id);
  });
});

describe("Unified Document Model - GET /api/documents/:id", () => {
  it("returns 200 with document for valid id", async () => {
    const doc = await seedDocument({
      title: "Test Doc",
      content: "Test content",
      document_type: "doc",
    });

    const res = await request(app).get(`/api/documents/${doc.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(doc.id);
    expect(res.body.title).toBe("Test Doc");
    expect(res.body.content).toBe("Test content");
    expect(res.body.document_type).toBe("doc");
  });

  it("returns document with all fields", async () => {
    const doc = await seedDocument();

    const res = await request(app).get(`/api/documents/${doc.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("title");
    expect(res.body).toHaveProperty("content");
    expect(res.body).toHaveProperty("document_type");
    expect(res.body).toHaveProperty("created_at");
    expect(res.body).toHaveProperty("updated_at");
    expect(res.body).toHaveProperty("deleted_at");
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app).get(
      "/api/documents/00000000-0000-0000-0000-000000000000"
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Document not found");
  });

  it("returns 404 for soft-deleted document", async () => {
    const doc = await seedDocument();
    await pool.query("UPDATE documents SET deleted_at = NOW() WHERE id = $1", [
      doc.id,
    ]);

    const res = await request(app).get(`/api/documents/${doc.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });

  it("can retrieve documents of different types", async () => {
    const docTypes = ["doc", "issue", "project", "week", "team"];

    for (const type of docTypes) {
      const doc = await seedDocument({ document_type: type });
      const res = await request(app).get(`/api/documents/${doc.id}`);
      expect(res.status).toBe(200);
      expect(res.body.document_type).toBe(type);
    }
  });
});

describe("Unified Document Model - POST /api/documents", () => {
  it("creates document with all required fields and returns 201", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "New Document",
      content: "Document content",
      document_type: "doc",
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe("New Document");
    expect(res.body.content).toBe("Document content");
    expect(res.body.document_type).toBe("doc");
    expect(res.body.created_at).toBeDefined();
    expect(res.body.updated_at).toBeDefined();
    expect(res.body.deleted_at).toBeNull();
  });

  it("creates document with empty content when not provided", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "Title Only",
      document_type: "doc",
    });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe("");
  });

  it("creates documents of type 'doc'", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "Doc",
      document_type: "doc",
    });

    expect(res.status).toBe(201);
    expect(res.body.document_type).toBe("doc");
  });

  it("creates documents of type 'issue'", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "Issue",
      document_type: "issue",
    });

    expect(res.status).toBe(201);
    expect(res.body.document_type).toBe("issue");
  });

  it("creates document with type 'issue' and verifies database storage", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "Bug Report",
      content: "Found a critical bug in the system",
      document_type: "issue",
    });

    expect(res.status).toBe(201);
    expect(res.body.document_type).toBe("issue");
    expect(res.body.title).toBe("Bug Report");
    expect(res.body.content).toBe("Found a critical bug in the system");
    expect(res.body.id).toBeDefined();

    // Verify it's actually stored in the database
    const dbResult = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [res.body.id]
    );

    expect(dbResult.rows).toHaveLength(1);
    expect(dbResult.rows[0].document_type).toBe("issue");
    expect(dbResult.rows[0].title).toBe("Bug Report");
    expect(dbResult.rows[0].content).toBe("Found a critical bug in the system");
  });

  it("creates documents of type 'project'", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "Project",
      document_type: "project",
    });

    expect(res.status).toBe(201);
    expect(res.body.document_type).toBe("project");
  });

  it("creates document with type 'project' and verifies database storage", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "New Product Launch",
      content: "Q1 2024 product launch project plan",
      document_type: "project",
    });

    expect(res.status).toBe(201);
    expect(res.body.document_type).toBe("project");
    expect(res.body.title).toBe("New Product Launch");
    expect(res.body.content).toBe("Q1 2024 product launch project plan");
    expect(res.body.id).toBeDefined();

    // Verify it's actually stored in the database
    const dbResult = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [res.body.id]
    );

    expect(dbResult.rows).toHaveLength(1);
    expect(dbResult.rows[0].document_type).toBe("project");
    expect(dbResult.rows[0].title).toBe("New Product Launch");
    expect(dbResult.rows[0].content).toBe("Q1 2024 product launch project plan");
  });

  it("creates documents of type 'week'", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "Week",
      document_type: "week",
    });

    expect(res.status).toBe(201);
    expect(res.body.document_type).toBe("week");
  });

  it("creates documents of type 'team'", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "Team",
      document_type: "team",
    });

    expect(res.status).toBe(201);
    expect(res.body.document_type).toBe("team");
  });

  it("creates documents of type 'ship'", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "Ship",
      content: "Ship content",
      document_type: "ship",
    });

    expect(res.status).toBe(201);
    expect(res.body.document_type).toBe("ship");
    expect(res.body.title).toBe("Ship");
    expect(res.body.content).toBe("Ship content");
    expect(res.body.id).toBeDefined();

    // Verify it's actually stored in the database
    const dbResult = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [res.body.id]
    );

    expect(dbResult.rows).toHaveLength(1);
    expect(dbResult.rows[0].document_type).toBe("ship");
    expect(dbResult.rows[0].title).toBe("Ship");
    expect(dbResult.rows[0].content).toBe("Ship content");
  });

  it("returns 400 when title is missing", async () => {
    const res = await request(app).post("/api/documents").send({
      content: "Content without title",
      document_type: "doc",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Title is required");
  });

  it("returns 400 when document_type is missing", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "Title without type",
      content: "Content",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Invalid document type");
  });

  it("returns 400 for invalid document_type", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "Invalid Type",
      document_type: "invalid",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Invalid document type");
  });

  it("persists document to database", async () => {
    const res = await request(app).post("/api/documents").send({
      title: "Persisted Doc",
      content: "Content",
      document_type: "doc",
    });

    const dbResult = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [res.body.id]
    );

    expect(dbResult.rows).toHaveLength(1);
    expect(dbResult.rows[0].title).toBe("Persisted Doc");
  });
});

describe("Unified Document Model - PUT /api/documents/:id", () => {
  it("updates title and returns 200", async () => {
    const doc = await seedDocument({ title: "Original Title" });

    const res = await request(app)
      .put(`/api/documents/${doc.id}`)
      .send({ title: "Updated Title" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Title");
    expect(res.body.id).toBe(doc.id);
  });

  it("updates content and returns 200", async () => {
    const doc = await seedDocument({ content: "Original content" });

    const res = await request(app)
      .put(`/api/documents/${doc.id}`)
      .send({ content: "Updated content" });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("Updated content");
  });

  it("updates both title and content", async () => {
    const doc = await seedDocument({
      title: "Original Title",
      content: "Original content",
    });

    const res = await request(app)
      .put(`/api/documents/${doc.id}`)
      .send({ title: "New Title", content: "New content" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("New Title");
    expect(res.body.content).toBe("New content");
  });

  it("updates updated_at timestamp", async () => {
    const doc = await seedDocument();
    const originalUpdatedAt = new Date(doc.updated_at);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const res = await request(app)
      .put(`/api/documents/${doc.id}`)
      .send({ title: "Updated" });

    expect(res.status).toBe(200);
    const newUpdatedAt = new Date(res.body.updated_at);
    expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it("does not change document_type", async () => {
    const doc = await seedDocument({ document_type: "doc" });

    const res = await request(app)
      .put(`/api/documents/${doc.id}`)
      .send({ title: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.document_type).toBe("doc");
  });

  it("can update documents of different types", async () => {
    const docTypes = ["doc", "issue", "project", "week", "team"];

    for (const type of docTypes) {
      const doc = await seedDocument({ document_type: type });
      const res = await request(app)
        .put(`/api/documents/${doc.id}`)
        .send({ title: `Updated ${type}` });

      expect(res.status).toBe(200);
      expect(res.body.document_type).toBe(type);
      expect(res.body.title).toBe(`Updated ${type}`);
    }
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app)
      .put("/api/documents/00000000-0000-0000-0000-000000000000")
      .send({ title: "Nope" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Document not found");
  });

  it("returns 404 for soft-deleted document", async () => {
    const doc = await seedDocument();
    await pool.query("UPDATE documents SET deleted_at = NOW() WHERE id = $1", [
      doc.id,
    ]);

    const res = await request(app)
      .put(`/api/documents/${doc.id}`)
      .send({ title: "Updated" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });

  it("returns 400 when no fields to update", async () => {
    const doc = await seedDocument();

    const res = await request(app).put(`/api/documents/${doc.id}`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("No fields to update");
  });

  it("allows updating title to empty string", async () => {
    const doc = await seedDocument({ title: "Original" });

    const res = await request(app)
      .put(`/api/documents/${doc.id}`)
      .send({ title: "" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("");
  });

  it("allows updating content to empty string", async () => {
    const doc = await seedDocument({ content: "Original content" });

    const res = await request(app)
      .put(`/api/documents/${doc.id}`)
      .send({ content: "" });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("");
  });
});

describe("Unified Document Model - DELETE /api/documents/:id", () => {
  it("soft deletes document and returns 200", async () => {
    const doc = await seedDocument();

    const res = await request(app).delete(`/api/documents/${doc.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(doc.id);
    expect(res.body.deleted_at).not.toBeNull();
  });

  it("sets deleted_at timestamp", async () => {
    const doc = await seedDocument();

    const res = await request(app).delete(`/api/documents/${doc.id}`);

    expect(res.status).toBe(200);
    const deletedAt = new Date(res.body.deleted_at);
    expect(deletedAt.getTime()).toBeGreaterThan(0);
  });

  it("can soft delete documents of different types", async () => {
    const docTypes = ["doc", "issue", "project", "week", "team"];

    for (const type of docTypes) {
      const doc = await seedDocument({ document_type: type });
      const res = await request(app).delete(`/api/documents/${doc.id}`);

      expect(res.status).toBe(200);
      expect(res.body.deleted_at).not.toBeNull();
    }
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app).delete(
      "/api/documents/00000000-0000-0000-0000-000000000000"
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Document not found");
  });

  it("returns 404 when deleting already deleted document", async () => {
    const doc = await seedDocument();
    await request(app).delete(`/api/documents/${doc.id}`);

    const res = await request(app).delete(`/api/documents/${doc.id}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });

  it("GET returns 404 after soft delete", async () => {
    const doc = await seedDocument();
    await request(app).delete(`/api/documents/${doc.id}`);

    const res = await request(app).get(`/api/documents/${doc.id}`);

    expect(res.status).toBe(404);
  });

  it("deleted document not included in list", async () => {
    const doc1 = await seedDocument({ title: "Doc 1" });
    const doc2 = await seedDocument({ title: "Doc 2" });
    await request(app).delete(`/api/documents/${doc1.id}`);

    const res = await request(app).get("/api/documents");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(doc2.id);
  });

  it("document still exists in database after soft delete", async () => {
    const doc = await seedDocument();
    await request(app).delete(`/api/documents/${doc.id}`);

    const dbResult = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [doc.id]
    );

    expect(dbResult.rows).toHaveLength(1);
    expect(dbResult.rows[0].deleted_at).not.toBeNull();
  });

  it("verifies soft delete sets deleted_at without removing the row", async () => {
    // Create a document
    const createRes = await request(app).post("/api/documents").send({
      title: "Test Team Document",
      content: "Team document content",
      document_type: "team",
    });

    expect(createRes.status).toBe(201);
    const docId = createRes.body.id;
    const originalTitle = createRes.body.title;
    const originalContent = createRes.body.content;
    const originalType = createRes.body.document_type;

    // Perform soft delete
    const deleteRes = await request(app).delete(`/api/documents/${docId}`);

    // Verify API response
    expect(deleteRes.status).toBe(200);

    // Query database directly to verify row still exists
    const dbResult = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [docId]
    );

    // Verify the row exists
    expect(dbResult.rows).toHaveLength(1);
    const deletedDoc = dbResult.rows[0];

    // Verify deleted_at is set
    expect(deletedDoc.deleted_at).not.toBeNull();
    expect(new Date(deletedDoc.deleted_at).getTime()).toBeGreaterThan(0);

    // Verify other fields remain unchanged
    expect(deletedDoc.title).toBe(originalTitle);
    expect(deletedDoc.content).toBe(originalContent);
    expect(deletedDoc.document_type).toBe(originalType);

    // Verify document is not returned in subsequent API queries
    const getRes = await request(app).get(`/api/documents/${docId}`);
    expect(getRes.status).toBe(404);

    const listRes = await request(app).get("/api/documents");
    expect(listRes.body.find((d: any) => d.id === docId)).toBeUndefined();
  });
});

describe("Unified Document Model - Integration Tests", () => {
  it("supports full CRUD lifecycle for a document", async () => {
    // Create
    const createRes = await request(app).post("/api/documents").send({
      title: "Lifecycle Test",
      content: "Initial content",
      document_type: "doc",
    });
    expect(createRes.status).toBe(201);
    const docId = createRes.body.id;

    // Read
    const readRes = await request(app).get(`/api/documents/${docId}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.title).toBe("Lifecycle Test");

    // Update
    const updateRes = await request(app)
      .put(`/api/documents/${docId}`)
      .send({ title: "Updated Lifecycle Test" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe("Updated Lifecycle Test");

    // Delete
    const deleteRes = await request(app).delete(`/api/documents/${docId}`);
    expect(deleteRes.status).toBe(200);

    // Verify deleted
    const verifyRes = await request(app).get(`/api/documents/${docId}`);
    expect(verifyRes.status).toBe(404);
  });

  it("maintains data isolation between document types", async () => {
    const doc = await seedDocument({ title: "Doc", document_type: "doc" });
    const issue = await seedDocument({
      title: "Issue",
      document_type: "issue",
    });
    const project = await seedDocument({
      title: "Project",
      document_type: "project",
    });

    const docRes = await request(app).get("/api/documents?type=doc");
    expect(docRes.body).toHaveLength(1);
    expect(docRes.body[0].id).toBe(doc.id);

    const issueRes = await request(app).get("/api/documents?type=issue");
    expect(issueRes.body).toHaveLength(1);
    expect(issueRes.body[0].id).toBe(issue.id);

    const projectRes = await request(app).get("/api/documents?type=project");
    expect(projectRes.body).toHaveLength(1);
    expect(projectRes.body[0].id).toBe(project.id);
  });

  it("handles multiple documents with same title but different types", async () => {
    await seedDocument({ title: "Same Title", document_type: "doc" });
    await seedDocument({ title: "Same Title", document_type: "issue" });
    await seedDocument({ title: "Same Title", document_type: "project" });

    const res = await request(app).get("/api/documents");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.every((d: any) => d.title === "Same Title")).toBe(true);

    const types = res.body.map((d: any) => d.document_type).sort();
    expect(types).toEqual(["doc", "issue", "project"]);
  });

  it("preserves document type through update operations", async () => {
    const doc = await seedDocument({
      title: "Original",
      document_type: "issue",
    });

    await request(app)
      .put(`/api/documents/${doc.id}`)
      .send({ title: "Updated 1" });

    await request(app)
      .put(`/api/documents/${doc.id}`)
      .send({ content: "Updated content" });

    const res = await request(app).get(`/api/documents/${doc.id}`);
    expect(res.status).toBe(200);
    expect(res.body.document_type).toBe("issue");
  });

  it("handles concurrent operations on different document types", async () => {
    const promises = [
      request(app)
        .post("/api/documents")
        .send({ title: "Doc 1", document_type: "doc" }),
      request(app)
        .post("/api/documents")
        .send({ title: "Issue 1", document_type: "issue" }),
      request(app)
        .post("/api/documents")
        .send({ title: "Project 1", document_type: "project" }),
      request(app)
        .post("/api/documents")
        .send({ title: "Week 1", document_type: "week" }),
      request(app)
        .post("/api/documents")
        .send({ title: "Team 1", document_type: "team" }),
    ];

    const results = await Promise.all(promises);
    expect(results.every((r) => r.status === 201)).toBe(true);

    const listRes = await request(app).get("/api/documents");
    expect(listRes.body).toHaveLength(5);
  });
});
