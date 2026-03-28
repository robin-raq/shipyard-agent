import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import pg from "pg";
import { createWeeksRouter } from "../routes/weeks.js";

// Test database setup
const testPool = new pg.Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    "postgresql://ship:ship@localhost:5433/ship_test",
});

const app = express();
app.use(express.json());
app.use("/api/weeks", createWeeksRouter(testPool));

describe("Accountability API", () => {
  beforeAll(async () => {
    // Create tables for testing
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS weeks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        content TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        properties JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      )
    `);
  });

  afterAll(async () => {
    // Clean up test data
    await testPool.query("DROP TABLE IF EXISTS weeks CASCADE");
    await testPool.end();
  });

  describe("POST /api/weeks", () => {
    it("should create a new week", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "Week 1 - Sprint Planning",
          content: "This week we focused on planning the next sprint.",
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body.title).toBe("Week 1 - Sprint Planning");
      expect(response.body.content).toBe("This week we focused on planning the next sprint.");
      expect(response.body).toHaveProperty("created_at");
      expect(response.body).toHaveProperty("updated_at");
    });

    it("should create a week with only title", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "Week 2 - Development",
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe("Week 2 - Development");
      expect(response.body.content).toBe("");
    });

    it("should reject week without title", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          content: "Content without title",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Title is required");
    });

    it("should reject week with empty title", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "",
          content: "Some content",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Title is required");
    });

    it("should handle long content", async () => {
      const longContent = "A".repeat(5000);
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "Week with long content",
          content: longContent,
        });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe(longContent);
    });
  });

  describe("GET /api/weeks", () => {
    beforeAll(async () => {
      // Create test weeks
      await request(app).post("/api/weeks").send({
        title: "Test Week 1",
        content: "First test week",
      });

      await request(app).post("/api/weeks").send({
        title: "Test Week 2",
        content: "Second test week",
      });

      await request(app).post("/api/weeks").send({
        title: "Test Week 3",
        content: "Third test week",
      });
    });

    it("should list all weeks", async () => {
      const response = await request(app).get("/api/weeks");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
    });

    it("should return weeks in descending order by creation date", async () => {
      const response = await request(app).get("/api/weeks");

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);

      // Check that weeks are ordered by created_at DESC
      for (let i = 0; i < response.body.length - 1; i++) {
        const current = new Date(response.body[i].created_at);
        const next = new Date(response.body[i + 1].created_at);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it("should not include deleted weeks", async () => {
      // Create and delete a week
      const createResponse = await request(app).post("/api/weeks").send({
        title: "Week to be deleted",
        content: "This will be deleted",
      });

      const weekId = createResponse.body.id;

      await request(app).delete(`/api/weeks/${weekId}`);

      // List all weeks
      const listResponse = await request(app).get("/api/weeks");

      expect(listResponse.status).toBe(200);
      const deletedWeek = listResponse.body.find((w: any) => w.id === weekId);
      expect(deletedWeek).toBeUndefined();
    });
  });

  describe("GET /api/weeks/:id", () => {
    let testWeekId: string;

    beforeAll(async () => {
      const response = await request(app).post("/api/weeks").send({
        title: "Single Week Test",
        content: "Content for single week test",
      });
      testWeekId = response.body.id;
    });

    it("should get a single week by id", async () => {
      const response = await request(app).get(`/api/weeks/${testWeekId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testWeekId);
      expect(response.body.title).toBe("Single Week Test");
      expect(response.body.content).toBe("Content for single week test");
    });

    it("should return 404 for non-existent week", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app).get(`/api/weeks/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("Week not found");
    });

    it("should return 404 for deleted week", async () => {
      // Create and delete a week
      const createResponse = await request(app).post("/api/weeks").send({
        title: "Week to delete",
        content: "Will be deleted",
      });

      const weekId = createResponse.body.id;
      await request(app).delete(`/api/weeks/${weekId}`);

      // Try to get the deleted week
      const response = await request(app).get(`/api/weeks/${weekId}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("Week not found");
    });

    it("should handle invalid UUID format", async () => {
      const response = await request(app).get("/api/weeks/invalid-uuid");

      // Depending on implementation, might return 400 or 500
      expect([400, 500]).toContain(response.status);
    });
  });

  describe("PUT /api/weeks/:id", () => {
    let testWeekId: string;

    beforeAll(async () => {
      const response = await request(app).post("/api/weeks").send({
        title: "Week to Update",
        content: "Original content",
      });
      testWeekId = response.body.id;
    });

    it("should update week title", async () => {
      const response = await request(app)
        .put(`/api/weeks/${testWeekId}`)
        .send({
          title: "Updated Week Title",
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe("Updated Week Title");
      expect(response.body.content).toBe("Original content");
    });

    it("should update week content", async () => {
      const response = await request(app)
        .put(`/api/weeks/${testWeekId}`)
        .send({
          content: "Updated content",
        });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe("Updated content");
    });

    it("should update both title and content", async () => {
      const response = await request(app)
        .put(`/api/weeks/${testWeekId}`)
        .send({
          title: "Fully Updated Week",
          content: "Fully updated content",
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe("Fully Updated Week");
      expect(response.body.content).toBe("Fully updated content");
    });

    it("should update the updated_at timestamp", async () => {
      const beforeUpdate = new Date();

      const response = await request(app)
        .put(`/api/weeks/${testWeekId}`)
        .send({
          title: "Timestamp Test",
        });

      expect(response.status).toBe(200);
      const updatedAt = new Date(response.body.updated_at);
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it("should reject update with no fields", async () => {
      const response = await request(app)
        .put(`/api/weeks/${testWeekId}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("No fields to update");
    });

    it("should return 404 for non-existent week", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app)
        .put(`/api/weeks/${fakeId}`)
        .send({
          title: "Update non-existent",
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("Week not found");
    });

    it("should not update deleted week", async () => {
      // Create and delete a week
      const createResponse = await request(app).post("/api/weeks").send({
        title: "Week to delete then update",
        content: "Content",
      });

      const weekId = createResponse.body.id;
      await request(app).delete(`/api/weeks/${weekId}`);

      // Try to update the deleted week
      const response = await request(app)
        .put(`/api/weeks/${weekId}`)
        .send({
          title: "Should not update",
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("Week not found");
    });
  });

  describe("DELETE /api/weeks/:id", () => {
    it("should soft delete a week", async () => {
      // Create a week
      const createResponse = await request(app).post("/api/weeks").send({
        title: "Week to Delete",
        content: "This will be deleted",
      });

      const weekId = createResponse.body.id;

      // Delete the week
      const deleteResponse = await request(app).delete(`/api/weeks/${weekId}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.id).toBe(weekId);
      expect(deleteResponse.body).toHaveProperty("deleted_at");
      expect(deleteResponse.body.deleted_at).not.toBeNull();
    });

    it("should not be able to get deleted week", async () => {
      // Create a week
      const createResponse = await request(app).post("/api/weeks").send({
        title: "Week to Delete and Verify",
        content: "Content",
      });

      const weekId = createResponse.body.id;

      // Delete the week
      await request(app).delete(`/api/weeks/${weekId}`);

      // Try to get the deleted week
      const getResponse = await request(app).get(`/api/weeks/${weekId}`);

      expect(getResponse.status).toBe(404);
    });

    it("should return 404 when deleting non-existent week", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app).delete(`/api/weeks/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("Week not found");
    });

    it("should return 404 when deleting already deleted week", async () => {
      // Create a week
      const createResponse = await request(app).post("/api/weeks").send({
        title: "Week to Double Delete",
        content: "Content",
      });

      const weekId = createResponse.body.id;

      // Delete the week
      await request(app).delete(`/api/weeks/${weekId}`);

      // Try to delete again
      const secondDeleteResponse = await request(app).delete(`/api/weeks/${weekId}`);

      expect(secondDeleteResponse.status).toBe(404);
      expect(secondDeleteResponse.body.message).toContain("Week not found");
    });

    it("should preserve deleted week data in database", async () => {
      // Create a week
      const createResponse = await request(app).post("/api/weeks").send({
        title: "Week to Check Preservation",
        content: "Content to preserve",
      });

      const weekId = createResponse.body.id;

      // Delete the week
      await request(app).delete(`/api/weeks/${weekId}`);

      // Query database directly to verify data is preserved
      const result = await testPool.query(
        "SELECT * FROM weeks WHERE id = $1",
        [weekId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].title).toBe("Week to Check Preservation");
      expect(result.rows[0].content).toBe("Content to preserve");
      expect(result.rows[0].deleted_at).not.toBeNull();
    });
  });

  describe("Input Validation", () => {
    it("should handle null title", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: null,
          content: "Content",
        });

      expect(response.status).toBe(400);
    });

    it("should handle undefined title", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          content: "Content",
        });

      expect(response.status).toBe(400);
    });

    it("should accept empty content", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "Week with empty content",
          content: "",
        });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe("");
    });

    it("should accept null content", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "Week with null content",
          content: null,
        });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe("");
    });

    it("should handle special characters in title", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "Week #1: Planning & Design (2024)",
          content: "Content",
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe("Week #1: Planning & Design (2024)");
    });

    it("should handle unicode characters", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "Week 周 - 日本語テスト",
          content: "Content with émojis 🚀 and spëcial çharacters",
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe("Week 周 - 日本語テスト");
      expect(response.body.content).toBe("Content with émojis 🚀 and spëcial çharacters");
    });

    it("should handle HTML in content", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "Week with HTML",
          content: "<script>alert('xss')</script><p>Paragraph</p>",
        });

      expect(response.status).toBe(201);
      // Content should be stored as-is (sanitization should happen on frontend)
      expect(response.body.content).toContain("<script>");
    });

    it("should handle markdown in content", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "Week with Markdown",
          content: "# Heading\n\n- Item 1\n- Item 2\n\n**Bold** and *italic*",
        });

      expect(response.status).toBe(201);
      expect(response.body.content).toContain("# Heading");
      expect(response.body.content).toContain("**Bold**");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long title", async () => {
      const longTitle = "A".repeat(300);
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: longTitle,
          content: "Content",
        });

      // Depending on database constraints, might succeed or fail
      // If VARCHAR(255), should fail or truncate
      expect([201, 400, 500]).toContain(response.status);
    });

    it("should handle concurrent updates", async () => {
      // Create a week
      const createResponse = await request(app).post("/api/weeks").send({
        title: "Concurrent Update Test",
        content: "Original",
      });

      const weekId = createResponse.body.id;

      // Perform concurrent updates
      const [update1, update2] = await Promise.all([
        request(app).put(`/api/weeks/${weekId}`).send({ content: "Update 1" }),
        request(app).put(`/api/weeks/${weekId}`).send({ content: "Update 2" }),
      ]);

      expect(update1.status).toBe(200);
      expect(update2.status).toBe(200);

      // Get final state
      const finalResponse = await request(app).get(`/api/weeks/${weekId}`);
      expect(finalResponse.status).toBe(200);
      // One of the updates should have won
      expect(["Update 1", "Update 2"]).toContain(finalResponse.body.content);
    });

    it("should handle rapid creation", async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app).post("/api/weeks").send({
            title: `Rapid Week ${i}`,
            content: `Content ${i}`,
          })
        );
      }

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // All should have unique IDs
      const ids = responses.map((r) => r.body.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });

    it("should handle SQL injection attempts in title", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "'; DROP TABLE weeks; --",
          content: "Malicious content",
        });

      // Should either succeed (with parameterized queries protecting us)
      // or fail validation
      expect([201, 400]).toContain(response.status);

      // Verify table still exists
      const listResponse = await request(app).get("/api/weeks");
      expect(listResponse.status).toBe(200);
    });

    it("should handle SQL injection attempts in content", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "SQL Injection Test",
          content: "1' OR '1'='1",
        });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe("1' OR '1'='1");
    });

    it("should handle whitespace-only title", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "   ",
          content: "Content",
        });

      // Depending on validation, might accept or reject
      expect([201, 400]).toContain(response.status);
    });

    it("should handle newlines in title", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send({
          title: "Week\nWith\nNewlines",
          content: "Content",
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toContain("\n");
    });

    it("should handle missing request body", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .send();

      expect(response.status).toBe(400);
    });

    it("should handle malformed JSON", async () => {
      const response = await request(app)
        .post("/api/weeks")
        .set("Content-Type", "application/json")
        .send("{ invalid json }");

      expect(response.status).toBe(400);
    });
  });

  describe("Data Integrity", () => {
    it("should maintain referential integrity on creation", async () => {
      const response = await request(app).post("/api/weeks").send({
        title: "Integrity Test Week",
        content: "Testing data integrity",
      });

      expect(response.status).toBe(201);

      // Verify in database
      const result = await testPool.query(
        "SELECT * FROM weeks WHERE id = $1",
        [response.body.id]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].title).toBe("Integrity Test Week");
      expect(result.rows[0].deleted_at).toBeNull();
    });

    it("should set default timestamps on creation", async () => {
      const beforeCreate = new Date();

      const response = await request(app).post("/api/weeks").send({
        title: "Timestamp Test",
        content: "Content",
      });

      const afterCreate = new Date();

      expect(response.status).toBe(201);

      const createdAt = new Date(response.body.created_at);
      const updatedAt = new Date(response.body.updated_at);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it("should generate unique UUIDs", async () => {
      const response1 = await request(app).post("/api/weeks").send({
        title: "UUID Test 1",
        content: "Content",
      });

      const response2 = await request(app).post("/api/weeks").send({
        title: "UUID Test 2",
        content: "Content",
      });

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.id).not.toBe(response2.body.id);

      // Verify UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(response1.body.id).toMatch(uuidRegex);
      expect(response2.body.id).toMatch(uuidRegex);
    });

    it("should not modify created_at on update", async () => {
      // Create a week
      const createResponse = await request(app).post("/api/weeks").send({
        title: "Created At Test",
        content: "Original",
      });

      const originalCreatedAt = createResponse.body.created_at;
      const weekId = createResponse.body.id;

      // Wait a bit to ensure timestamp would be different
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update the week
      const updateResponse = await request(app)
        .put(`/api/weeks/${weekId}`)
        .send({
          content: "Updated",
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.created_at).toBe(originalCreatedAt);
      expect(updateResponse.body.updated_at).not.toBe(originalCreatedAt);
    });
  });

  describe("Performance", () => {
    it("should handle listing many weeks efficiently", async () => {
      // Create multiple weeks
      const createPromises = [];
      for (let i = 0; i < 20; i++) {
        createPromises.push(
          request(app).post("/api/weeks").send({
            title: `Performance Test Week ${i}`,
            content: `Content ${i}`,
          })
        );
      }

      await Promise.all(createPromises);

      // Measure list performance
      const startTime = Date.now();
      const response = await request(app).get("/api/weeks");
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(20);

      // Should complete in reasonable time (< 1 second)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000);
    });
  });
});
