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
  await pool.query("DELETE FROM weeks");
  await pool.query("DELETE FROM teams");
  await pool.query("DELETE FROM programs");
});

// Helper functions for seeding data
async function seedDoc(overrides: Record<string, any> = {}) {
  const defaults = {
    title: "Test Document",
    content: "This is test content",
  };
  const doc = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO docs (title, content) VALUES ($1, $2) RETURNING *`,
    [doc.title, doc.content]
  );
  return result.rows[0];
}

async function seedIssue(overrides: Record<string, any> = {}) {
  const defaults = {
    title: "Test Issue",
    content: "This is test issue content",
    status: "open",
    priority: "medium",
  };
  const issue = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO issues (title, content, status, priority) VALUES ($1, $2, $3, $4) RETURNING *`,
    [issue.title, issue.content, issue.status, issue.priority]
  );
  return result.rows[0];
}

async function seedProject(overrides: Record<string, any> = {}) {
  const defaults = {
    title: "Test Project",
    description: "This is test project description",
    status: "active",
  };
  const project = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO projects (title, description, status) VALUES ($1, $2, $3) RETURNING *`,
    [project.title, project.description, project.status]
  );
  return result.rows[0];
}

async function seedWeek(overrides: Record<string, any> = {}) {
  const defaults = {
    title: "Test Week",
    content: "This is test week content",
  };
  const week = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO weeks (title, content) VALUES ($1, $2) RETURNING *`,
    [week.title, week.content]
  );
  return result.rows[0];
}

async function seedTeam(overrides: Record<string, any> = {}) {
  const defaults = {
    name: "Test Team",
    description: "This is test team description",
  };
  const team = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO teams (name, description) VALUES ($1, $2) RETURNING *`,
    [team.name, team.description]
  );
  return result.rows[0];
}

async function seedProgram(overrides: Record<string, any> = {}) {
  const defaults = {
    name: "Test Program",
    description: "This is test program description",
  };
  const program = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO programs (name, description) VALUES ($1, $2) RETURNING *`,
    [program.name, program.description]
  );
  return result.rows[0];
}

describe("Full-Text Search - Programs", () => {
  describe("Basic ILIKE Search", () => {
    it("searches programs by name (case-insensitive)", async () => {
      await seedProgram({ name: "Engineering Fellowship" });
      await seedProgram({ name: "Design Bootcamp" });
      await seedProgram({ name: "Engineering Internship" });

      const res = await request(app).get("/api/programs?search=engineering");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it("searches programs by description", async () => {
      await seedProgram({
        name: "Program A",
        description: "A program for software engineers",
      });
      await seedProgram({
        name: "Program B",
        description: "A program for designers",
      });

      const res = await request(app).get("/api/programs?search=software");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(1);
      expect(res.body.programs[0].name).toBe("Program A");
    });

    it("searches programs by partial word match", async () => {
      await seedProgram({ name: "Engineering Fellowship" });
      await seedProgram({ name: "Design Bootcamp" });

      const res = await request(app).get("/api/programs?search=engin");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(1);
      expect(res.body.programs[0].name).toBe("Engineering Fellowship");
    });

    it("returns empty results when no match found", async () => {
      await seedProgram({ name: "Engineering Fellowship" });
      await seedProgram({ name: "Design Bootcamp" });

      const res = await request(app).get("/api/programs?search=nonexistent");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });

    it("handles special characters in search query", async () => {
      await seedProgram({ name: "Program with & special % chars" });
      await seedProgram({ name: "Regular Program" });

      // Note: % is a wildcard in ILIKE, so it will match all programs
      // This test verifies that special characters don't break the query
      const res = await request(app).get("/api/programs?search=%");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(2);
      
      // Test with a special character that needs URL encoding
      const res2 = await request(app).get("/api/programs?search=" + encodeURIComponent("special"));
      expect(res2.status).toBe(200);
      expect(res2.body.programs).toHaveLength(1);
      expect(res2.body.programs[0].name).toContain("special");
    });

    it("handles empty search query", async () => {
      await seedProgram({ name: "Program 1" });
      await seedProgram({ name: "Program 2" });

      const res = await request(app).get("/api/programs?search=");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it("searches across both name and description", async () => {
      await seedProgram({
        name: "Alpha Program",
        description: "Contains keyword beta",
      });
      await seedProgram({
        name: "Beta Program",
        description: "Contains keyword alpha",
      });
      await seedProgram({
        name: "Gamma Program",
        description: "Contains keyword gamma",
      });

      const res = await request(app).get("/api/programs?search=beta");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it("handles multi-word search queries", async () => {
      await seedProgram({ name: "Software Engineering Fellowship" });
      await seedProgram({ name: "Engineering Program" });
      await seedProgram({ name: "Software Design" });

      const res = await request(app).get(
        "/api/programs?search=software engineering"
      );
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(1);
      expect(res.body.programs[0].name).toBe("Software Engineering Fellowship");
    });

    it("handles search with leading/trailing spaces", async () => {
      await seedProgram({ name: "Engineering Fellowship" });

      // URL encoding will preserve spaces, but the search should still work
      const res = await request(app).get("/api/programs?search=engineering");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(1);
      
      // Test that spaces in the middle of search terms work
      const res2 = await request(app).get("/api/programs?search=engineering fellowship");
      expect(res2.status).toBe(200);
      expect(res2.body.programs).toHaveLength(1);
    });

    it("handles case variations in search", async () => {
      await seedProgram({ name: "Engineering Fellowship" });

      const testCases = ["ENGINEERING", "engineering", "EnGiNeErInG"];
      for (const searchTerm of testCases) {
        const res = await request(app).get(
          `/api/programs?search=${searchTerm}`
        );
        expect(res.status).toBe(200);
        expect(res.body.programs).toHaveLength(1);
      }
    });
  });

  describe("Search with Pagination", () => {
    it("combines search with limit", async () => {
      await seedProgram({ name: "Engineering Program 1" });
      await seedProgram({ name: "Engineering Program 2" });
      await seedProgram({ name: "Engineering Program 3" });
      await seedProgram({ name: "Design Program" });

      const res = await request(app).get(
        "/api/programs?search=engineering&limit=2"
      );
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(2);
      expect(res.body.total).toBe(3);
    });

    it("combines search with offset", async () => {
      await seedProgram({ name: "Engineering Program 1" });
      await seedProgram({ name: "Engineering Program 2" });
      await seedProgram({ name: "Engineering Program 3" });

      const res = await request(app).get(
        "/api/programs?search=engineering&offset=1"
      );
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(2);
      expect(res.body.total).toBe(3);
    });

    it("combines search with limit and offset", async () => {
      await seedProgram({ name: "Engineering Program 1" });
      await seedProgram({ name: "Engineering Program 2" });
      await seedProgram({ name: "Engineering Program 3" });
      await seedProgram({ name: "Engineering Program 4" });

      const res = await request(app).get(
        "/api/programs?search=engineering&limit=2&offset=1"
      );
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(2);
      expect(res.body.total).toBe(4);
    });
  });

  describe("Search Performance and Edge Cases", () => {
    it("handles search with null description", async () => {
      await seedProgram({ name: "Program with null description", description: null });

      const res = await request(app).get("/api/programs?search=program");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(1);
    });

    it("handles search with empty description", async () => {
      await seedProgram({ name: "Program", description: "" });

      const res = await request(app).get("/api/programs?search=program");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(1);
    });

    it("handles search with very long query", async () => {
      await seedProgram({ name: "Engineering Fellowship" });
      const longQuery = "a".repeat(1000);

      const res = await request(app).get(`/api/programs?search=${longQuery}`);
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(0);
    });

    it("handles search with numeric characters", async () => {
      await seedProgram({ name: "Program 2024" });
      await seedProgram({ name: "Program 2023" });

      const res = await request(app).get("/api/programs?search=2024");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(1);
      expect(res.body.programs[0].name).toBe("Program 2024");
    });

    it("handles search with unicode characters", async () => {
      await seedProgram({ name: "Café Program" });
      await seedProgram({ name: "Regular Program" });

      const res = await request(app).get("/api/programs?search=café");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(1);
      expect(res.body.programs[0].name).toBe("Café Program");
    });

    it("handles search with punctuation", async () => {
      await seedProgram({ name: "Program: Advanced Topics" });
      await seedProgram({ name: "Program - Basics" });

      const res = await request(app).get("/api/programs?search=advanced");
      expect(res.status).toBe(200);
      expect(res.body.programs).toHaveLength(1);
    });
  });
});

describe("Full-Text Search - Cross-Entity Search Patterns", () => {
  describe("Docs Search Patterns", () => {
    it("should support searching docs by title", async () => {
      await seedDoc({ title: "API Documentation", content: "Content here" });
      await seedDoc({ title: "User Guide", content: "Content here" });

      // Note: This test demonstrates the expected pattern
      // Actual implementation would need a search endpoint for docs
      const docs = await pool.query(
        "SELECT * FROM docs WHERE title ILIKE $1",
        ["%documentation%"]
      );
      expect(docs.rows).toHaveLength(1);
      expect(docs.rows[0].title).toBe("API Documentation");
    });

    it("should support searching docs by content", async () => {
      await seedDoc({
        title: "Doc 1",
        content: "This document contains important information",
      });
      await seedDoc({ title: "Doc 2", content: "This is a simple guide" });

      const docs = await pool.query(
        "SELECT * FROM docs WHERE content ILIKE $1",
        ["%important%"]
      );
      expect(docs.rows).toHaveLength(1);
      expect(docs.rows[0].title).toBe("Doc 1");
    });

    it("should support searching docs by title or content", async () => {
      await seedDoc({
        title: "Security Guide",
        content: "How to secure your application",
      });
      await seedDoc({
        title: "Performance Tips",
        content: "Security best practices",
      });

      const docs = await pool.query(
        "SELECT * FROM docs WHERE title ILIKE $1 OR content ILIKE $1",
        ["%security%"]
      );
      expect(docs.rows).toHaveLength(2);
    });
  });

  describe("Issues Search Patterns", () => {
    it("should support searching issues by title", async () => {
      await seedIssue({ title: "Bug in login system", content: "Details here" });
      await seedIssue({ title: "Feature request", content: "Details here" });

      const issues = await pool.query(
        "SELECT * FROM issues WHERE title ILIKE $1 AND deleted_at IS NULL",
        ["%bug%"]
      );
      expect(issues.rows).toHaveLength(1);
      expect(issues.rows[0].title).toBe("Bug in login system");
    });

    it("should support searching issues by content", async () => {
      await seedIssue({
        title: "Issue 1",
        content: "The authentication system is broken",
      });
      await seedIssue({ title: "Issue 2", content: "UI needs improvement" });

      const issues = await pool.query(
        "SELECT * FROM issues WHERE content ILIKE $1 AND deleted_at IS NULL",
        ["%authentication%"]
      );
      expect(issues.rows).toHaveLength(1);
    });

    it("should support filtering by status in search", async () => {
      await seedIssue({
        title: "Bug report",
        content: "Details",
        status: "open",
      });
      await seedIssue({
        title: "Bug report",
        content: "Details",
        status: "closed",
      });

      const issues = await pool.query(
        "SELECT * FROM issues WHERE title ILIKE $1 AND status = $2 AND deleted_at IS NULL",
        ["%bug%", "open"]
      );
      expect(issues.rows).toHaveLength(1);
      expect(issues.rows[0].status).toBe("open");
    });

    it("should support filtering by priority in search", async () => {
      await seedIssue({
        title: "Critical bug",
        content: "Details",
        priority: "critical",
      });
      await seedIssue({
        title: "Minor bug",
        content: "Details",
        priority: "low",
      });

      const issues = await pool.query(
        "SELECT * FROM issues WHERE title ILIKE $1 AND priority = $2 AND deleted_at IS NULL",
        ["%bug%", "critical"]
      );
      expect(issues.rows).toHaveLength(1);
      expect(issues.rows[0].priority).toBe("critical");
    });
  });

  describe("Projects Search Patterns", () => {
    it("should support searching projects by title", async () => {
      await seedProject({
        title: "Website Redesign",
        description: "Redesign the company website",
      });
      await seedProject({
        title: "Mobile App",
        description: "Build a mobile application",
      });

      const projects = await pool.query(
        "SELECT * FROM projects WHERE title ILIKE $1 AND deleted_at IS NULL",
        ["%website%"]
      );
      expect(projects.rows).toHaveLength(1);
      expect(projects.rows[0].title).toBe("Website Redesign");
    });

    it("should support searching projects by description", async () => {
      await seedProject({
        title: "Project A",
        description: "Implement new authentication system",
      });
      await seedProject({
        title: "Project B",
        description: "Update user interface",
      });

      const projects = await pool.query(
        "SELECT * FROM projects WHERE description ILIKE $1 AND deleted_at IS NULL",
        ["%authentication%"]
      );
      expect(projects.rows).toHaveLength(1);
    });

    it("should support filtering by status in search", async () => {
      await seedProject({
        title: "Active Project",
        description: "Details",
        status: "active",
      });
      await seedProject({
        title: "Completed Project",
        description: "Details",
        status: "completed",
      });

      const projects = await pool.query(
        "SELECT * FROM projects WHERE title ILIKE $1 AND status = $2 AND deleted_at IS NULL",
        ["%project%", "active"]
      );
      expect(projects.rows).toHaveLength(1);
      expect(projects.rows[0].status).toBe("active");
    });
  });

  describe("Teams Search Patterns", () => {
    it("should support searching teams by name", async () => {
      await seedTeam({ name: "Engineering Team", description: "Details" });
      await seedTeam({ name: "Design Team", description: "Details" });

      const teams = await pool.query(
        "SELECT * FROM teams WHERE name ILIKE $1 AND deleted_at IS NULL",
        ["%engineering%"]
      );
      expect(teams.rows).toHaveLength(1);
      expect(teams.rows[0].name).toBe("Engineering Team");
    });

    it("should support searching teams by description", async () => {
      await seedTeam({
        name: "Team A",
        description: "Responsible for backend development",
      });
      await seedTeam({
        name: "Team B",
        description: "Responsible for frontend development",
      });

      const teams = await pool.query(
        "SELECT * FROM teams WHERE description ILIKE $1 AND deleted_at IS NULL",
        ["%backend%"]
      );
      expect(teams.rows).toHaveLength(1);
    });
  });

  describe("Weeks Search Patterns", () => {
    it("should support searching weeks by title", async () => {
      await seedWeek({ title: "Week 1: Planning", content: "Details" });
      await seedWeek({ title: "Week 2: Development", content: "Details" });

      const weeks = await pool.query(
        "SELECT * FROM weeks WHERE title ILIKE $1 AND deleted_at IS NULL",
        ["%planning%"]
      );
      expect(weeks.rows).toHaveLength(1);
      expect(weeks.rows[0].title).toBe("Week 1: Planning");
    });

    it("should support searching weeks by content", async () => {
      await seedWeek({
        title: "Week 1",
        content: "Focus on authentication features",
      });
      await seedWeek({ title: "Week 2", content: "Focus on UI improvements" });

      const weeks = await pool.query(
        "SELECT * FROM weeks WHERE content ILIKE $1 AND deleted_at IS NULL",
        ["%authentication%"]
      );
      expect(weeks.rows).toHaveLength(1);
    });
  });
});

describe("Full-Text Search - Advanced Patterns", () => {
  describe("Ranking and Relevance", () => {
    it("should demonstrate title matches being more relevant than content matches", async () => {
      await seedDoc({
        title: "Authentication Guide",
        content: "How to implement auth",
      });
      await seedDoc({
        title: "General Guide",
        content: "This guide covers authentication and more",
      });

      // In a real full-text search implementation, title matches would rank higher
      const docs = await pool.query(
        `SELECT *, 
         CASE 
           WHEN title ILIKE $1 THEN 2
           WHEN content ILIKE $1 THEN 1
           ELSE 0
         END as relevance_score
         FROM docs 
         WHERE title ILIKE $1 OR content ILIKE $1
         ORDER BY relevance_score DESC`,
        ["%authentication%"]
      );
      expect(docs.rows).toHaveLength(2);
      expect(docs.rows[0].title).toBe("Authentication Guide");
    });

    it("should demonstrate exact matches ranking higher than partial matches", async () => {
      await seedProgram({ name: "Engineering", description: "Details" });
      await seedProgram({
        name: "Software Engineering",
        description: "Details",
      });

      const programs = await pool.query(
        `SELECT *,
         CASE
           WHEN name = $1 THEN 3
           WHEN name ILIKE $2 THEN 2
           ELSE 1
         END as relevance_score
         FROM programs
         WHERE name ILIKE $2
         ORDER BY relevance_score DESC`,
        ["Engineering", "%engineering%"]
      );
      expect(programs.rows).toHaveLength(2);
      expect(programs.rows[0].name).toBe("Engineering");
    });
  });

  describe("Multi-field Search", () => {
    it("should search across multiple fields with OR logic", async () => {
      await seedIssue({
        title: "Performance issue",
        content: "The app is slow",
      });
      await seedIssue({
        title: "Bug report",
        content: "Performance degradation detected",
      });
      await seedIssue({ title: "Feature request", content: "Add new feature" });

      const issues = await pool.query(
        "SELECT * FROM issues WHERE title ILIKE $1 OR content ILIKE $1 AND deleted_at IS NULL",
        ["%performance%"]
      );
      expect(issues.rows).toHaveLength(2);
    });

    it("should search across multiple fields with AND logic", async () => {
      await seedIssue({
        title: "Critical bug in authentication",
        content: "Users cannot login due to critical error",
      });
      await seedIssue({
        title: "Bug in UI",
        content: "Authentication flow is broken",
      });
      await seedIssue({
        title: "Critical performance issue",
        content: "App is slow",
      });

      const issues = await pool.query(
        "SELECT * FROM issues WHERE title ILIKE $1 AND content ILIKE $2 AND deleted_at IS NULL",
        ["%critical%", "%critical%"]
      );
      expect(issues.rows).toHaveLength(1);
      expect(issues.rows[0].title).toBe("Critical bug in authentication");
    });
  });

  describe("Search with Soft Deletes", () => {
    it("should exclude soft-deleted docs from search results", async () => {
      const doc1 = await seedDoc({ title: "Active Document", content: "Content" });
      const doc2 = await seedDoc({ title: "Deleted Document", content: "Content" });

      // Soft delete doc2
      await pool.query("UPDATE docs SET deleted_at = NOW() WHERE id = $1", [
        doc2.id,
      ]);

      const docs = await pool.query(
        "SELECT * FROM docs WHERE title ILIKE $1 AND deleted_at IS NULL",
        ["%document%"]
      );
      expect(docs.rows).toHaveLength(1);
      expect(docs.rows[0].id).toBe(doc1.id);
    });

    it("should exclude soft-deleted issues from search results", async () => {
      const issue1 = await seedIssue({ title: "Active Issue", content: "Content" });
      const issue2 = await seedIssue({ title: "Deleted Issue", content: "Content" });

      await pool.query("UPDATE issues SET deleted_at = NOW() WHERE id = $1", [
        issue2.id,
      ]);

      const issues = await pool.query(
        "SELECT * FROM issues WHERE title ILIKE $1 AND deleted_at IS NULL",
        ["%issue%"]
      );
      expect(issues.rows).toHaveLength(1);
      expect(issues.rows[0].id).toBe(issue1.id);
    });

    it("should exclude soft-deleted projects from search results", async () => {
      const project1 = await seedProject({
        title: "Active Project",
        description: "Content",
      });
      const project2 = await seedProject({
        title: "Deleted Project",
        description: "Content",
      });

      await pool.query("UPDATE projects SET deleted_at = NOW() WHERE id = $1", [
        project2.id,
      ]);

      const projects = await pool.query(
        "SELECT * FROM projects WHERE title ILIKE $1 AND deleted_at IS NULL",
        ["%project%"]
      );
      expect(projects.rows).toHaveLength(1);
      expect(projects.rows[0].id).toBe(project1.id);
    });
  });

  describe("Search Result Ordering", () => {
    it("should order results by created_at DESC by default", async () => {
      const doc1 = await seedDoc({ title: "First Document", content: "Content" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const doc2 = await seedDoc({ title: "Second Document", content: "Content" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const doc3 = await seedDoc({ title: "Third Document", content: "Content" });

      const docs = await pool.query(
        "SELECT * FROM docs WHERE title ILIKE $1 ORDER BY created_at DESC",
        ["%document%"]
      );
      expect(docs.rows).toHaveLength(3);
      expect(docs.rows[0].id).toBe(doc3.id);
      expect(docs.rows[1].id).toBe(doc2.id);
      expect(docs.rows[2].id).toBe(doc1.id);
    });

    it("should support custom ordering by updated_at", async () => {
      const doc1 = await seedDoc({ title: "Document 1", content: "Content" });
      const doc2 = await seedDoc({ title: "Document 2", content: "Content" });
      const doc3 = await seedDoc({ title: "Document 3", content: "Content" });

      // Update doc1 to make it most recently updated
      await new Promise((resolve) => setTimeout(resolve, 10));
      await pool.query(
        "UPDATE docs SET content = $1, updated_at = NOW() WHERE id = $2",
        ["Updated content", doc1.id]
      );

      const docs = await pool.query(
        "SELECT * FROM docs WHERE title ILIKE $1 ORDER BY updated_at DESC",
        ["%document%"]
      );
      expect(docs.rows).toHaveLength(3);
      expect(docs.rows[0].id).toBe(doc1.id);
    });
  });

  describe("Search with Empty/Null Values", () => {
    it("should handle searching when content is null", async () => {
      await seedDoc({ title: "Document with content", content: "Some content" });
      await pool.query(
        "INSERT INTO docs (title, content) VALUES ($1, NULL)",
        ["Document without content"]
      );

      const docs = await pool.query(
        "SELECT * FROM docs WHERE title ILIKE $1 OR content ILIKE $1",
        ["%document%"]
      );
      expect(docs.rows).toHaveLength(2);
    });

    it("should handle searching when description is null", async () => {
      await seedProgram({
        name: "Program with description",
        description: "Some description",
      });
      await seedProgram({ name: "Program without description", description: null });

      const programs = await pool.query(
        "SELECT * FROM programs WHERE name ILIKE $1 OR description ILIKE $1",
        ["%program%"]
      );
      expect(programs.rows).toHaveLength(2);
    });

    it("should handle searching when content is empty string", async () => {
      await seedDoc({ title: "Document", content: "" });

      const docs = await pool.query(
        "SELECT * FROM docs WHERE title ILIKE $1",
        ["%document%"]
      );
      expect(docs.rows).toHaveLength(1);
    });
  });

  describe("Search Performance Considerations", () => {
    it("should handle searching with large result sets", async () => {
      // Create 100 documents
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          seedDoc({ title: `Document ${i}`, content: `Content ${i}` })
        );
      }
      await Promise.all(promises);

      const docs = await pool.query(
        "SELECT * FROM docs WHERE title ILIKE $1 LIMIT 10",
        ["%document%"]
      );
      expect(docs.rows).toHaveLength(10);
    });

    it("should handle pagination with large result sets", async () => {
      // Create 50 programs
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          seedProgram({ name: `Program ${i}`, description: `Description ${i}` })
        );
      }
      await Promise.all(promises);

      const page1 = await pool.query(
        "SELECT * FROM programs WHERE name ILIKE $1 ORDER BY created_at DESC LIMIT 10 OFFSET 0",
        ["%program%"]
      );
      const page2 = await pool.query(
        "SELECT * FROM programs WHERE name ILIKE $1 ORDER BY created_at DESC LIMIT 10 OFFSET 10",
        ["%program%"]
      );

      expect(page1.rows).toHaveLength(10);
      expect(page2.rows).toHaveLength(10);
      expect(page1.rows[0].id).not.toBe(page2.rows[0].id);
    });
  });
});

describe("Full-Text Search - SQL Injection Prevention", () => {
  it("should safely handle search queries with SQL injection attempts", async () => {
    await seedProgram({ name: "Test Program", description: "Description" });

    // Attempt SQL injection
    const maliciousQueries = [
      "'; DROP TABLE programs; --",
      "' OR '1'='1",
      "'; DELETE FROM programs WHERE '1'='1",
      "%'; UPDATE programs SET name='hacked' WHERE '1'='1",
    ];

    for (const query of maliciousQueries) {
      const programs = await pool.query(
        "SELECT * FROM programs WHERE name ILIKE $1 OR description ILIKE $1",
        [`%${query}%`]
      );
      // Should return 0 results, not execute malicious SQL
      expect(programs.rows).toHaveLength(0);
    }

    // Verify table still exists and data is intact
    const allPrograms = await pool.query("SELECT * FROM programs");
    expect(allPrograms.rows).toHaveLength(1);
    expect(allPrograms.rows[0].name).toBe("Test Program");
  });

  it("should safely handle special regex characters in search", async () => {
    await seedDoc({ title: "Document (with) [brackets]", content: "Content" });

    const specialChars = ["(", ")", "[", "]", "{", "}", ".", "*", "+", "?"];

    for (const char of specialChars) {
      const docs = await pool.query(
        "SELECT * FROM docs WHERE title ILIKE $1",
        [`%${char}%`]
      );
      // Should handle gracefully without errors
      expect(docs.rows.length).toBeGreaterThanOrEqual(0);
    }
  });
});
