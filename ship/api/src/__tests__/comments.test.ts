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
  // Clean up comments and related entities
  await pool.query("DELETE FROM comments");
  await pool.query("DELETE FROM issues");
  await pool.query("DELETE FROM docs");
  await pool.query("DELETE FROM projects");
});

// Helper function to seed an issue for commenting
async function seedIssue(overrides: Record<string, string> = {}) {
  const defaults = { 
    title: "Test Issue", 
    content: "Issue content",
    status: "open",
    priority: "medium"
  };
  const issue = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO issues (title, content, status, priority)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [issue.title, issue.content, issue.status, issue.priority]
  );
  return result.rows[0];
}

// Helper function to seed a doc for commenting
async function seedDoc(overrides: Record<string, string> = {}) {
  const defaults = { title: "Test Doc", content: "Doc content" };
  const doc = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO docs (title, content)
     VALUES ($1, $2) RETURNING *`,
    [doc.title, doc.content]
  );
  return result.rows[0];
}

// Helper function to seed a comment
async function seedComment(
  entityType: string,
  entityId: string,
  overrides: Record<string, any> = {}
) {
  const defaults = { 
    content: "Test comment",
    author_name: "Test User"
  };
  const comment = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO comments (entity_type, entity_id, content, author_name)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [entityType, entityId, comment.content, comment.author_name]
  );
  return result.rows[0];
}

describe("GET /api/comments", () => {
  it("returns 200 with array of all comments", async () => {
    const issue = await seedIssue();
    await seedComment("issue", issue.id);
    await seedComment("issue", issue.id, { content: "Another comment" });

    const res = await request(app).get("/api/comments");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("filters comments by entity_type", async () => {
    const issue = await seedIssue();
    const doc = await seedDoc();
    await seedComment("issue", issue.id);
    await seedComment("doc", doc.id);

    const res = await request(app).get("/api/comments?entity_type=issue");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].entity_type).toBe("issue");
  });

  it("filters comments by entity_id", async () => {
    const issue1 = await seedIssue();
    const issue2 = await seedIssue({ title: "Another Issue" });
    await seedComment("issue", issue1.id);
    await seedComment("issue", issue1.id, { content: "Second comment" });
    await seedComment("issue", issue2.id);

    const res = await request(app).get(`/api/comments?entity_id=${issue1.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((c: any) => c.entity_id === issue1.id)).toBe(true);
  });

  it("filters comments by both entity_type and entity_id", async () => {
    const issue = await seedIssue();
    const doc = await seedDoc();
    await seedComment("issue", issue.id);
    await seedComment("doc", doc.id);

    const res = await request(app).get(
      `/api/comments?entity_type=issue&entity_id=${issue.id}`
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].entity_type).toBe("issue");
    expect(res.body[0].entity_id).toBe(issue.id);
  });

  it("excludes soft-deleted comments", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);
    await pool.query("UPDATE comments SET deleted_at = NOW() WHERE id = $1", [
      comment.id,
    ]);

    const res = await request(app).get("/api/comments");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("returns comments ordered by created_at DESC", async () => {
    const issue = await seedIssue();
    const comment1 = await seedComment("issue", issue.id, { content: "First" });
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    const comment2 = await seedComment("issue", issue.id, { content: "Second" });

    const res = await request(app).get("/api/comments");
    expect(res.status).toBe(200);
    expect(res.body[0].content).toBe("Second");
    expect(res.body[1].content).toBe("First");
  });
});

describe("GET /api/comments/:id", () => {
  it("returns 200 with comment", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app).get(`/api/comments/${comment.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(comment.id);
    expect(res.body.content).toBe("Test comment");
    expect(res.body.entity_type).toBe("issue");
    expect(res.body.entity_id).toBe(issue.id);
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app).get(
      "/api/comments/00000000-0000-0000-0000-000000000000"
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Comment not found");
  });

  it("returns 404 for soft-deleted comment", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);
    await pool.query("UPDATE comments SET deleted_at = NOW() WHERE id = $1", [
      comment.id,
    ]);

    const res = await request(app).get(`/api/comments/${comment.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });
});

describe("POST /api/comments", () => {
  it("creates comment and returns 201", async () => {
    const issue = await seedIssue();
    const res = await request(app)
      .post("/api/comments")
      .send({
        entity_type: "issue",
        entity_id: issue.id,
        content: "Great issue!",
        author_name: "John Doe",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.content).toBe("Great issue!");
    expect(res.body.author_name).toBe("John Doe");
    expect(res.body.entity_type).toBe("issue");
    expect(res.body.entity_id).toBe(issue.id);
    expect(res.body.created_at).toBeDefined();
  });

  it("returns 400 when entity_type is missing", async () => {
    const issue = await seedIssue();
    const res = await request(app)
      .post("/api/comments")
      .send({
        entity_id: issue.id,
        content: "Comment without type",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("entity_type is required");
  });

  it("returns 400 when entity_id is missing", async () => {
    const res = await request(app)
      .post("/api/comments")
      .send({
        entity_type: "issue",
        content: "Comment without entity_id",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("entity_id is required");
  });

  it("returns 400 when content is missing", async () => {
    const issue = await seedIssue();
    const res = await request(app)
      .post("/api/comments")
      .send({
        entity_type: "issue",
        entity_id: issue.id,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("content is required");
  });

  it("returns 400 for invalid entity_type", async () => {
    const issue = await seedIssue();
    const res = await request(app)
      .post("/api/comments")
      .send({
        entity_type: "invalid_type",
        entity_id: issue.id,
        content: "Comment",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Invalid entity_type");
  });

  it("accepts valid entity_types: issue, doc, project, week, team", async () => {
    const issue = await seedIssue();
    const validTypes = ["issue", "doc", "project", "week", "team"];

    for (const type of validTypes) {
      const res = await request(app)
        .post("/api/comments")
        .send({
          entity_type: type,
          entity_id: issue.id,
          content: `Comment on ${type}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.entity_type).toBe(type);
    }
  });

  it("uses default author_name if not provided", async () => {
    const issue = await seedIssue();
    const res = await request(app)
      .post("/api/comments")
      .send({
        entity_type: "issue",
        entity_id: issue.id,
        content: "Anonymous comment",
      });

    expect(res.status).toBe(201);
    expect(res.body.author_name).toBe("Anonymous");
  });

  it("trims whitespace from content", async () => {
    const issue = await seedIssue();
    const res = await request(app)
      .post("/api/comments")
      .send({
        entity_type: "issue",
        entity_id: issue.id,
        content: "  Whitespace comment  ",
      });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe("Whitespace comment");
  });

  it("returns 400 for empty content after trimming", async () => {
    const issue = await seedIssue();
    const res = await request(app)
      .post("/api/comments")
      .send({
        entity_type: "issue",
        entity_id: issue.id,
        content: "   ",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("content cannot be empty");
  });
});

describe("PUT /api/comments/:id", () => {
  it("updates comment content and returns 200", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app)
      .put(`/api/comments/${comment.id}`)
      .send({ content: "Updated comment" });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("Updated comment");
    expect(new Date(res.body.updated_at).getTime()).toBeGreaterThan(
      new Date(comment.updated_at).getTime()
    );
  });

  it("updates author_name and returns 200", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app)
      .put(`/api/comments/${comment.id}`)
      .send({ author_name: "Jane Doe" });

    expect(res.status).toBe(200);
    expect(res.body.author_name).toBe("Jane Doe");
  });

  it("updates both content and author_name", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app)
      .put(`/api/comments/${comment.id}`)
      .send({
        content: "New content",
        author_name: "New Author",
      });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("New content");
    expect(res.body.author_name).toBe("New Author");
  });

  it("returns 400 when no fields to update", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app)
      .put(`/api/comments/${comment.id}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("No fields to update");
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app)
      .put("/api/comments/00000000-0000-0000-0000-000000000000")
      .send({ content: "Updated" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Comment not found");
  });

  it("returns 404 for soft-deleted comment", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);
    await pool.query("UPDATE comments SET deleted_at = NOW() WHERE id = $1", [
      comment.id,
    ]);

    const res = await request(app)
      .put(`/api/comments/${comment.id}`)
      .send({ content: "Updated" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });

  it("trims whitespace from updated content", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app)
      .put(`/api/comments/${comment.id}`)
      .send({ content: "  Updated  " });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("Updated");
  });

  it("returns 400 for empty content after trimming", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app)
      .put(`/api/comments/${comment.id}`)
      .send({ content: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("content cannot be empty");
  });

  it("does not allow updating entity_type or entity_id", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);
    const originalEntityType = comment.entity_type;
    const originalEntityId = comment.entity_id;

    const res = await request(app)
      .put(`/api/comments/${comment.id}`)
      .send({
        content: "Updated",
        entity_type: "doc",
        entity_id: "00000000-0000-0000-0000-000000000000",
      });

    expect(res.status).toBe(200);
    expect(res.body.entity_type).toBe(originalEntityType);
    expect(res.body.entity_id).toBe(originalEntityId);
  });
});

describe("PATCH /api/comments/:id", () => {
  it("partially updates comment content and returns 200", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app)
      .patch(`/api/comments/${comment.id}`)
      .send({ content: "Patched comment" });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("Patched comment");
    expect(res.body.author_name).toBe(comment.author_name); // unchanged
    expect(new Date(res.body.updated_at).getTime()).toBeGreaterThan(
      new Date(comment.updated_at).getTime()
    );
  });

  it("partially updates author_name and returns 200", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);
    const originalContent = comment.content;

    const res = await request(app)
      .patch(`/api/comments/${comment.id}`)
      .send({ author_name: "Patched Author" });

    expect(res.status).toBe(200);
    expect(res.body.author_name).toBe("Patched Author");
    expect(res.body.content).toBe(originalContent); // unchanged
  });

  it("updates both content and author_name", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app)
      .patch(`/api/comments/${comment.id}`)
      .send({
        content: "Patched content",
        author_name: "Patched Author",
      });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("Patched content");
    expect(res.body.author_name).toBe("Patched Author");
  });

  it("returns 400 when no fields to update", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app)
      .patch(`/api/comments/${comment.id}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("No fields to update");
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app)
      .patch("/api/comments/00000000-0000-0000-0000-000000000000")
      .send({ content: "Patched" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Comment not found");
  });

  it("returns 404 for soft-deleted comment", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);
    await pool.query("UPDATE comments SET deleted_at = NOW() WHERE id = $1", [
      comment.id,
    ]);

    const res = await request(app)
      .patch(`/api/comments/${comment.id}`)
      .send({ content: "Patched" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });

  it("trims whitespace from patched content", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app)
      .patch(`/api/comments/${comment.id}`)
      .send({ content: "  Patched  " });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("Patched");
  });

  it("returns 400 for empty content after trimming", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app)
      .patch(`/api/comments/${comment.id}`)
      .send({ content: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("content cannot be empty");
  });

  it("validates content length", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);
    const longContent = "x".repeat(10001);

    const res = await request(app)
      .patch(`/api/comments/${comment.id}`)
      .send({ content: longContent });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toContain("content is too long");
  });

  it("validates author_name length", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);
    const longName = "x".repeat(256);

    const res = await request(app)
      .patch(`/api/comments/${comment.id}`)
      .send({ author_name: longName });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toContain("author_name is too long");
  });
});

describe("DELETE /api/comments/:id", () => {
  it("soft deletes comment and returns 200", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app).delete(`/api/comments/${comment.id}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted_at).toBeDefined();
  });

  it("GET returns 404 after soft delete", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    await request(app).delete(`/api/comments/${comment.id}`);
    const res = await request(app).get(`/api/comments/${comment.id}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app).delete(
      "/api/comments/00000000-0000-0000-0000-000000000000"
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Comment not found");
  });

  it("returns 404 for already deleted comment", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);
    await pool.query("UPDATE comments SET deleted_at = NOW() WHERE id = $1", [
      comment.id,
    ]);

    const res = await request(app).delete(`/api/comments/${comment.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });
});

describe("GET /api/:entity_type/:entity_id/comments", () => {
  it("returns comments for a specific issue", async () => {
    const issue = await seedIssue();
    await seedComment("issue", issue.id, { content: "Comment 1" });
    await seedComment("issue", issue.id, { content: "Comment 2" });

    const res = await request(app).get(`/api/issues/${issue.id}/comments`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("returns comments for a specific doc", async () => {
    const doc = await seedDoc();
    await seedComment("doc", doc.id, { content: "Doc comment" });

    const res = await request(app).get(`/api/docs/${doc.id}/comments`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe("Doc comment");
  });

  it("returns empty array when entity has no comments", async () => {
    const issue = await seedIssue();

    const res = await request(app).get(`/api/issues/${issue.id}/comments`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("returns 404 when entity does not exist", async () => {
    const res = await request(app).get(
      "/api/issues/00000000-0000-0000-0000-000000000000/comments"
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });

  it("excludes soft-deleted comments", async () => {
    const issue = await seedIssue();
    const comment1 = await seedComment("issue", issue.id);
    const comment2 = await seedComment("issue", issue.id, { content: "Comment 2" });
    await pool.query("UPDATE comments SET deleted_at = NOW() WHERE id = $1", [
      comment1.id,
    ]);

    const res = await request(app).get(`/api/issues/${issue.id}/comments`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(comment2.id);
  });
});

describe("Comment validation", () => {
  it("rejects content longer than 10000 characters", async () => {
    const issue = await seedIssue();
    const longContent = "a".repeat(10001);

    const res = await request(app)
      .post("/api/comments")
      .send({
        entity_type: "issue",
        entity_id: issue.id,
        content: longContent,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toContain("too long");
  });

  it("accepts content with exactly 10000 characters", async () => {
    const issue = await seedIssue();
    const maxContent = "a".repeat(10000);

    const res = await request(app)
      .post("/api/comments")
      .send({
        entity_type: "issue",
        entity_id: issue.id,
        content: maxContent,
      });

    expect(res.status).toBe(201);
    expect(res.body.content).toHaveLength(10000);
  });

  it("rejects author_name longer than 255 characters", async () => {
    const issue = await seedIssue();
    const longName = "a".repeat(256);

    const res = await request(app)
      .post("/api/comments")
      .send({
        entity_type: "issue",
        entity_id: issue.id,
        content: "Comment",
        author_name: longName,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toContain("author_name");
  });
});

describe("POST /api/comments/:id/resolve", () => {
  it("marks a comment as resolved and returns 200", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    const res = await request(app).post(`/api/comments/${comment.id}/resolve`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(comment.id);
    expect(res.body.resolved).toBe(true);
    expect(new Date(res.body.updated_at).getTime()).toBeGreaterThan(
      new Date(comment.updated_at).getTime()
    );
  });

  it("returns 404 for nonexistent comment", async () => {
    const res = await request(app).post(
      "/api/comments/00000000-0000-0000-0000-000000000000/resolve"
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Comment not found or already resolved");
  });

  it("returns 404 for already resolved comment", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);

    // Resolve the comment first
    await request(app).post(`/api/comments/${comment.id}/resolve`);

    // Try to resolve again
    const res = await request(app).post(`/api/comments/${comment.id}/resolve`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Comment not found or already resolved");
  });

  it("returns 404 for soft-deleted comment", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);
    await pool.query("UPDATE comments SET deleted_at = NOW() WHERE id = $1", [
      comment.id,
    ]);

    const res = await request(app).post(`/api/comments/${comment.id}/resolve`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Comment not found or already resolved");
  });

  it("updates the updated_at timestamp when resolving", async () => {
    const issue = await seedIssue();
    const comment = await seedComment("issue", issue.id);
    const originalUpdatedAt = new Date(comment.updated_at);

    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    const res = await request(app).post(`/api/comments/${comment.id}/resolve`);

    expect(res.status).toBe(200);
    expect(new Date(res.body.updated_at).getTime()).toBeGreaterThan(
      originalUpdatedAt.getTime()
    );
  });
});
