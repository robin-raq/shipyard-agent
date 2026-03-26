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
  // Clean up all tables (junction tables first due to foreign keys)
  await pool.query("DELETE FROM week_projects");
  await pool.query("DELETE FROM week_issues");
  await pool.query("DELETE FROM week_ships");
  await pool.query("DELETE FROM issues");
  await pool.query("DELETE FROM projects");
  await pool.query("DELETE FROM docs");
  await pool.query("DELETE FROM weeks");
  await pool.query("DELETE FROM teams");
  await pool.query("DELETE FROM ships");
});

// Helper functions to seed test data
async function seedProject(overrides: Record<string, any> = {}) {
  const defaults = {
    title: "Test Project",
    description: "Test Description",
    status: "active",
  };
  const project = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO projects (title, description, status)
     VALUES ($1, $2, $3) RETURNING *`,
    [project.title, project.description, project.status]
  );
  return result.rows[0];
}

async function seedIssue(overrides: Record<string, any> = {}) {
  const defaults = {
    title: "Test Issue",
    content: "Test Content",
    status: "open",
    priority: "medium",
  };
  const issue = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO issues (title, content, status, priority, project_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [issue.title, issue.content, issue.status, issue.priority, issue.project_id || null]
  );
  return result.rows[0];
}

async function seedDoc(overrides: Record<string, any> = {}) {
  const defaults = { title: "Test Doc", content: "Content" };
  const doc = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO docs (title, content)
     VALUES ($1, $2) RETURNING *`,
    [doc.title, doc.content]
  );
  return result.rows[0];
}

async function seedWeek(overrides: Record<string, any> = {}) {
  const defaults = {
    title: "Week 1",
    content: "Week content",
    start_date: "2024-01-01",
    end_date: "2024-01-07",
  };
  const week = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO weeks (title, content, start_date, end_date)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [week.title, week.content, week.start_date, week.end_date]
  );
  return result.rows[0];
}

async function seedTeam(overrides: Record<string, any> = {}) {
  const defaults = { name: "Test Team", description: "Team description" };
  const team = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO teams (name, description)
     VALUES ($1, $2) RETURNING *`,
    [team.name, team.description]
  );
  return result.rows[0];
}

async function seedShip(overrides: Record<string, any> = {}) {
  const defaults = {
    name: "Test Ship",
    description: "Ship description",
    status: "active",
  };
  const ship = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO ships (name, description, status)
     VALUES ($1, $2, $3) RETURNING *`,
    [ship.name, ship.description, ship.status]
  );
  return result.rows[0];
}

describe("GET /api/dashboard", () => {
  it("returns 200 with empty dashboard when no data exists", async () => {
    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("stats");
    expect(res.body).toHaveProperty("recent");
  });

  it("returns correct counts for all entities", async () => {
    // Seed data
    await seedProject();
    await seedProject();
    await seedIssue();
    await seedDoc();
    await seedWeek();
    await seedTeam();
    await seedShip();

    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({
      projects: 2,
      issues: 1,
      docs: 1,
      weeks: 1,
      teams: 1,
      ships: 1,
    });
  });

  it("excludes soft-deleted items from counts", async () => {
    const project = await seedProject();
    await seedProject();
    await pool.query("UPDATE projects SET deleted_at = NOW() WHERE id = $1", [
      project.id,
    ]);

    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.stats.projects).toBe(1);
  });

  it("returns recent items from each category", async () => {
    await seedProject({ title: "Recent Project" });
    await seedIssue({ title: "Recent Issue" });
    await seedDoc({ title: "Recent Doc" });

    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.recent).toHaveProperty("projects");
    expect(res.body.recent).toHaveProperty("issues");
    expect(res.body.recent).toHaveProperty("docs");
    expect(res.body.recent.projects).toHaveLength(1);
    expect(res.body.recent.projects[0].title).toBe("Recent Project");
  });

  it("limits recent items to specified count", async () => {
    // Create 10 projects
    for (let i = 0; i < 10; i++) {
      await seedProject({ title: `Project ${i}` });
    }

    const res = await request(app).get("/api/dashboard?limit=5");
    expect(res.status).toBe(200);
    expect(res.body.recent.projects.length).toBeLessThanOrEqual(5);
  });

  it("returns items ordered by created_at DESC", async () => {
    const first = await seedProject({ title: "First Project" });
    // Wait a bit to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await seedProject({ title: "Second Project" });

    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.recent.projects[0].id).toBe(second.id);
    expect(res.body.recent.projects[1].id).toBe(first.id);
  });
});

describe("GET /api/dashboard/stats", () => {
  it("returns 200 with statistics breakdown", async () => {
    const res = await request(app).get("/api/dashboard/stats");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("projects");
    expect(res.body).toHaveProperty("issues");
    expect(res.body).toHaveProperty("ships");
  });

  it("returns project status breakdown", async () => {
    await seedProject({ status: "active" });
    await seedProject({ status: "active" });
    await seedProject({ status: "completed" });
    await seedProject({ status: "archived" });

    const res = await request(app).get("/api/dashboard/stats");
    expect(res.status).toBe(200);
    expect(res.body.projects).toMatchObject({
      total: 4,
      active: 2,
      completed: 1,
      archived: 1,
    });
  });

  it("returns issue status and priority breakdown", async () => {
    await seedIssue({ status: "open", priority: "high" });
    await seedIssue({ status: "open", priority: "medium" });
    await seedIssue({ status: "in_progress", priority: "high" });
    await seedIssue({ status: "done", priority: "low" });

    const res = await request(app).get("/api/dashboard/stats");
    expect(res.status).toBe(200);
    expect(res.body.issues).toMatchObject({
      total: 4,
      byStatus: {
        open: 2,
        in_progress: 1,
        done: 1,
        closed: 0,
      },
      byPriority: {
        low: 1,
        medium: 1,
        high: 2,
        critical: 0,
      },
    });
  });

  it("returns ship status breakdown", async () => {
    await seedShip({ status: "active" });
    await seedShip({ status: "active" });
    await seedShip({ status: "completed" });

    const res = await request(app).get("/api/dashboard/stats");
    expect(res.status).toBe(200);
    expect(res.body.ships).toMatchObject({
      total: 3,
      active: 2,
      completed: 1,
    });
  });

  it("excludes soft-deleted items from statistics", async () => {
    const issue = await seedIssue({ status: "open" });
    await seedIssue({ status: "done" });
    await pool.query("UPDATE issues SET deleted_at = NOW() WHERE id = $1", [
      issue.id,
    ]);

    const res = await request(app).get("/api/dashboard/stats");
    expect(res.status).toBe(200);
    expect(res.body.issues.total).toBe(1);
    expect(res.body.issues.byStatus.open).toBe(0);
    expect(res.body.issues.byStatus.done).toBe(1);
  });
});

describe("GET /api/dashboard/activity", () => {
  it("returns 200 with recent activity across all entities", async () => {
    const res = await request(app).get("/api/dashboard/activity");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns mixed activity from different entity types", async () => {
    await seedProject({ title: "New Project" });
    await seedIssue({ title: "New Issue" });
    await seedDoc({ title: "New Doc" });

    const res = await request(app).get("/api/dashboard/activity");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    
    const types = res.body.map((item: any) => item.type);
    expect(types).toContain("project");
    expect(types).toContain("issue");
    expect(types).toContain("doc");
  });

  it("includes entity type and basic info in activity items", async () => {
    await seedProject({ title: "Activity Project" });

    const res = await request(app).get("/api/dashboard/activity");
    expect(res.status).toBe(200);
    
    const projectActivity = res.body.find((item: any) => item.type === "project");
    expect(projectActivity).toBeDefined();
    expect(projectActivity).toHaveProperty("id");
    expect(projectActivity).toHaveProperty("title");
    expect(projectActivity).toHaveProperty("created_at");
    expect(projectActivity).toHaveProperty("type");
  });

  it("orders activity by created_at DESC", async () => {
    const first = await seedProject({ title: "First" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await seedIssue({ title: "Second" });

    const res = await request(app).get("/api/dashboard/activity");
    expect(res.status).toBe(200);
    
    // Most recent should be first
    expect(res.body[0].id).toBe(second.id);
  });

  it("limits activity items to specified count", async () => {
    for (let i = 0; i < 20; i++) {
      await seedProject({ title: `Project ${i}` });
    }

    const res = await request(app).get("/api/dashboard/activity?limit=10");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(10);
  });

  it("excludes soft-deleted items from activity", async () => {
    const project = await seedProject({ title: "Deleted Project" });
    await seedProject({ title: "Active Project" });
    await pool.query("UPDATE projects SET deleted_at = NOW() WHERE id = $1", [
      project.id,
    ]);

    const res = await request(app).get("/api/dashboard/activity");
    expect(res.status).toBe(200);
    
    const deletedItem = res.body.find((item: any) => item.id === project.id);
    expect(deletedItem).toBeUndefined();
  });
});

describe("GET /api/dashboard/summary", () => {
  it("returns 200 with comprehensive dashboard summary", async () => {
    const res = await request(app).get("/api/dashboard/summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("counts");
    expect(res.body).toHaveProperty("stats");
    expect(res.body).toHaveProperty("recentActivity");
  });

  it("provides complete overview in single request", async () => {
    await seedProject({ status: "active" });
    await seedIssue({ status: "open", priority: "high" });
    await seedShip({ status: "active" });

    const res = await request(app).get("/api/dashboard/summary");
    expect(res.status).toBe(200);
    
    // Should have counts
    expect(res.body.counts.projects).toBe(1);
    expect(res.body.counts.issues).toBe(1);
    expect(res.body.counts.ships).toBe(1);
    
    // Should have detailed stats
    expect(res.body.stats.projects.active).toBe(1);
    expect(res.body.stats.issues.byPriority.high).toBe(1);
    
    // Should have recent activity
    expect(res.body.recentActivity.length).toBeGreaterThan(0);
  });
});

describe("GET /api/dashboard/my-week", () => {
  it("returns 200 with current week data when no week specified", async () => {
    const res = await request(app).get("/api/dashboard/my-week");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("week");
    expect(res.body).toHaveProperty("projects");
    expect(res.body).toHaveProperty("issues");
    expect(res.body).toHaveProperty("ships");
  });

  it("returns the current week based on today's date", async () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday

    const week = await seedWeek({
      title: "Current Week",
      start_date: startOfWeek.toISOString().split("T")[0],
      end_date: endOfWeek.toISOString().split("T")[0],
    });

    const res = await request(app).get("/api/dashboard/my-week");
    expect(res.status).toBe(200);
    expect(res.body.week).toBeDefined();
    expect(res.body.week.id).toBe(week.id);
    expect(res.body.week.title).toBe("Current Week");
  });

  it("returns specific week when week_id is provided", async () => {
    const week1 = await seedWeek({
      title: "Week 1",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });
    const week2 = await seedWeek({
      title: "Week 2",
      start_date: "2024-01-08",
      end_date: "2024-01-14",
    });

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week1.id}`);
    expect(res.status).toBe(200);
    expect(res.body.week.id).toBe(week1.id);
    expect(res.body.week.title).toBe("Week 1");
  });

  it("returns 404 when specified week_id does not exist", async () => {
    const res = await request(app).get("/api/dashboard/my-week?week_id=99999");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("returns projects associated with the week", async () => {
    const week = await seedWeek({
      title: "Test Week",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });
    
    const project1 = await seedProject({ title: "Week Project 1" });
    const project2 = await seedProject({ title: "Week Project 2" });
    const project3 = await seedProject({ title: "Other Project" });

    // Associate projects with week
    await pool.query(
      `INSERT INTO week_projects (week_id, project_id) VALUES ($1, $2), ($1, $3)`,
      [week.id, project1.id, project2.id]
    );

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(2);
    
    const projectIds = res.body.projects.map((p: any) => p.id);
    expect(projectIds).toContain(project1.id);
    expect(projectIds).toContain(project2.id);
    expect(projectIds).not.toContain(project3.id);
  });

  it("returns issues associated with the week", async () => {
    const week = await seedWeek({
      title: "Test Week",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });
    
    const issue1 = await seedIssue({ title: "Week Issue 1", status: "open" });
    const issue2 = await seedIssue({ title: "Week Issue 2", status: "in_progress" });
    const issue3 = await seedIssue({ title: "Other Issue", status: "open" });

    // Associate issues with week
    await pool.query(
      `INSERT INTO week_issues (week_id, issue_id) VALUES ($1, $2), ($1, $3)`,
      [week.id, issue1.id, issue2.id]
    );

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(200);
    expect(res.body.issues).toHaveLength(2);
    
    const issueIds = res.body.issues.map((i: any) => i.id);
    expect(issueIds).toContain(issue1.id);
    expect(issueIds).toContain(issue2.id);
    expect(issueIds).not.toContain(issue3.id);
  });

  it("returns ships associated with the week", async () => {
    const week = await seedWeek({
      title: "Test Week",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });
    
    const ship1 = await seedShip({ name: "Week Ship 1", status: "active" });
    const ship2 = await seedShip({ name: "Week Ship 2", status: "completed" });
    const ship3 = await seedShip({ name: "Other Ship", status: "active" });

    // Associate ships with week
    await pool.query(
      `INSERT INTO week_ships (week_id, ship_id) VALUES ($1, $2), ($1, $3)`,
      [week.id, ship1.id, ship2.id]
    );

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ships).toHaveLength(2);
    
    const shipIds = res.body.ships.map((s: any) => s.id);
    expect(shipIds).toContain(ship1.id);
    expect(shipIds).toContain(ship2.id);
    expect(shipIds).not.toContain(ship3.id);
  });

  it("excludes soft-deleted week from results", async () => {
    const week = await seedWeek({
      title: "Deleted Week",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });
    
    await pool.query("UPDATE weeks SET deleted_at = NOW() WHERE id = $1", [week.id]);

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(404);
  });

  it("excludes soft-deleted projects from week view", async () => {
    const week = await seedWeek({
      title: "Test Week",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });
    
    const project1 = await seedProject({ title: "Active Project" });
    const project2 = await seedProject({ title: "Deleted Project" });

    await pool.query(
      `INSERT INTO week_projects (week_id, project_id) VALUES ($1, $2), ($1, $3)`,
      [week.id, project1.id, project2.id]
    );

    await pool.query("UPDATE projects SET deleted_at = NOW() WHERE id = $1", [project2.id]);

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].id).toBe(project1.id);
  });

  it("excludes soft-deleted issues from week view", async () => {
    const week = await seedWeek({
      title: "Test Week",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });
    
    const issue1 = await seedIssue({ title: "Active Issue" });
    const issue2 = await seedIssue({ title: "Deleted Issue" });

    await pool.query(
      `INSERT INTO week_issues (week_id, issue_id) VALUES ($1, $2), ($1, $3)`,
      [week.id, issue1.id, issue2.id]
    );

    await pool.query("UPDATE issues SET deleted_at = NOW() WHERE id = $1", [issue2.id]);

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(200);
    expect(res.body.issues).toHaveLength(1);
    expect(res.body.issues[0].id).toBe(issue1.id);
  });

  it("excludes soft-deleted ships from week view", async () => {
    const week = await seedWeek({
      title: "Test Week",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });
    
    const ship1 = await seedShip({ name: "Active Ship" });
    const ship2 = await seedShip({ name: "Deleted Ship" });

    await pool.query(
      `INSERT INTO week_ships (week_id, ship_id) VALUES ($1, $2), ($1, $3)`,
      [week.id, ship1.id, ship2.id]
    );

    await pool.query("UPDATE ships SET deleted_at = NOW() WHERE id = $1", [ship2.id]);

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ships).toHaveLength(1);
    expect(res.body.ships[0].id).toBe(ship1.id);
  });

  it("returns empty arrays when week has no associated items", async () => {
    const week = await seedWeek({
      title: "Empty Week",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(200);
    expect(res.body.week.id).toBe(week.id);
    expect(res.body.projects).toEqual([]);
    expect(res.body.issues).toEqual([]);
    expect(res.body.ships).toEqual([]);
  });

  it("includes week metadata (title, content, dates)", async () => {
    const week = await seedWeek({
      title: "Detailed Week",
      content: "This week's goals and notes",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(200);
    expect(res.body.week).toMatchObject({
      id: week.id,
      title: "Detailed Week",
      content: "This week's goals and notes",
      start_date: expect.any(String),
      end_date: expect.any(String),
    });
  });

  it("returns projects with their full details", async () => {
    const week = await seedWeek({
      title: "Test Week",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });
    
    const project = await seedProject({
      title: "Detailed Project",
      description: "Project description",
      status: "active",
    });

    await pool.query(
      `INSERT INTO week_projects (week_id, project_id) VALUES ($1, $2)`,
      [week.id, project.id]
    );

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(200);
    expect(res.body.projects[0]).toMatchObject({
      id: project.id,
      title: "Detailed Project",
      description: "Project description",
      status: "active",
    });
  });

  it("returns issues with their full details including status and priority", async () => {
    const week = await seedWeek({
      title: "Test Week",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });
    
    const issue = await seedIssue({
      title: "Detailed Issue",
      content: "Issue content",
      status: "in_progress",
      priority: "high",
    });

    await pool.query(
      `INSERT INTO week_issues (week_id, issue_id) VALUES ($1, $2)`,
      [week.id, issue.id]
    );

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(200);
    expect(res.body.issues[0]).toMatchObject({
      id: issue.id,
      title: "Detailed Issue",
      content: "Issue content",
      status: "in_progress",
      priority: "high",
    });
  });

  it("returns ships with their full details", async () => {
    const week = await seedWeek({
      title: "Test Week",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });
    
    const ship = await seedShip({
      name: "Detailed Ship",
      description: "Ship description",
      status: "completed",
    });

    await pool.query(
      `INSERT INTO week_ships (week_id, ship_id) VALUES ($1, $2)`,
      [week.id, ship.id]
    );

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ships[0]).toMatchObject({
      id: ship.id,
      name: "Detailed Ship",
      description: "Ship description",
      status: "completed",
    });
  });

  it("handles multiple items of each type correctly", async () => {
    const week = await seedWeek({
      title: "Busy Week",
      start_date: "2024-01-01",
      end_date: "2024-01-07",
    });
    
    // Create multiple items
    const projects = await Promise.all([
      seedProject({ title: "Project 1" }),
      seedProject({ title: "Project 2" }),
      seedProject({ title: "Project 3" }),
    ]);
    
    const issues = await Promise.all([
      seedIssue({ title: "Issue 1" }),
      seedIssue({ title: "Issue 2" }),
    ]);
    
    const ships = await Promise.all([
      seedShip({ name: "Ship 1" }),
      seedShip({ name: "Ship 2" }),
      seedShip({ name: "Ship 3" }),
      seedShip({ name: "Ship 4" }),
    ]);

    // Associate all with week
    for (const project of projects) {
      await pool.query(
        `INSERT INTO week_projects (week_id, project_id) VALUES ($1, $2)`,
        [week.id, project.id]
      );
    }
    
    for (const issue of issues) {
      await pool.query(
        `INSERT INTO week_issues (week_id, issue_id) VALUES ($1, $2)`,
        [week.id, issue.id]
      );
    }
    
    for (const ship of ships) {
      await pool.query(
        `INSERT INTO week_ships (week_id, ship_id) VALUES ($1, $2)`,
        [week.id, ship.id]
      );
    }

    const res = await request(app).get(`/api/dashboard/my-week?week_id=${week.id}`);
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(3);
    expect(res.body.issues).toHaveLength(2);
    expect(res.body.ships).toHaveLength(4);
  });

  it("returns null week when no current week exists and no week_id provided", async () => {
    // Create a week in the past
    await seedWeek({
      title: "Past Week",
      start_date: "2020-01-01",
      end_date: "2020-01-07",
    });

    const res = await request(app).get("/api/dashboard/my-week");
    expect(res.status).toBe(200);
    expect(res.body.week).toBeNull();
    expect(res.body.projects).toEqual([]);
    expect(res.body.issues).toEqual([]);
    expect(res.body.ships).toEqual([]);
  });
});

describe("GET /api/dashboard/recent", () => {
  it("returns 200 with empty array when no documents exist", async () => {
    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toEqual([]);
  });

  it("returns last 5 edited documents across all types", async () => {
    // Create documents with different updated_at times
    const doc1 = await seedDoc({ title: "Doc 1" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const project1 = await seedProject({ title: "Project 1" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const issue1 = await seedIssue({ title: "Issue 1" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const week1 = await seedWeek({ title: "Week 1" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const team1 = await seedTeam({ name: "Team 1" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ship1 = await seedShip({ name: "Ship 1" });

    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    
    // Most recent should be first (ship1)
    expect(res.body[0].id).toBe(ship1.id);
    expect(res.body[0].type).toBe("ship");
    
    // Should not include the oldest (doc1)
    const docIds = res.body.map((item: any) => item.id);
    expect(docIds).not.toContain(doc1.id);
  });

  it("includes document type in response", async () => {
    await seedDoc({ title: "Test Doc" });
    await seedProject({ title: "Test Project" });
    await seedIssue({ title: "Test Issue" });

    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    
    const types = res.body.map((item: any) => item.type);
    expect(types).toContain("doc");
    expect(types).toContain("project");
    expect(types).toContain("issue");
  });

  it("includes title or name field in response", async () => {
    await seedDoc({ title: "My Document" });
    await seedTeam({ name: "My Team" });
    await seedShip({ name: "My Ship" });

    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    
    // Docs, projects, issues, weeks have 'title'
    const docItem = res.body.find((item: any) => item.type === "doc");
    expect(docItem).toHaveProperty("title", "My Document");
    
    // Teams and ships have 'name'
    const teamItem = res.body.find((item: any) => item.type === "team");
    expect(teamItem).toHaveProperty("name", "My Team");
    
    const shipItem = res.body.find((item: any) => item.type === "ship");
    expect(shipItem).toHaveProperty("name", "My Ship");
  });

  it("orders documents by updated_at DESC", async () => {
    const first = await seedProject({ title: "First" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await seedDoc({ title: "Second" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const third = await seedIssue({ title: "Third" });

    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    
    // Most recent first
    expect(res.body[0].id).toBe(third.id);
    expect(res.body[1].id).toBe(second.id);
    expect(res.body[2].id).toBe(first.id);
  });

  it("updates order when document is edited", async () => {
    const doc1 = await seedDoc({ title: "Doc 1" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const doc2 = await seedDoc({ title: "Doc 2" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const doc3 = await seedDoc({ title: "Doc 3" });

    // Edit doc1 to make it most recent
    await pool.query(
      "UPDATE docs SET title = $1, updated_at = NOW() WHERE id = $2",
      ["Doc 1 Updated", doc1.id]
    );

    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    
    // doc1 should now be first
    expect(res.body[0].id).toBe(doc1.id);
    expect(res.body[0].title).toBe("Doc 1 Updated");
  });

  it("excludes soft-deleted documents", async () => {
    const project1 = await seedProject({ title: "Active Project" });
    const project2 = await seedProject({ title: "Deleted Project" });
    await seedDoc({ title: "Active Doc" });

    // Soft delete project2
    await pool.query("UPDATE projects SET deleted_at = NOW() WHERE id = $1", [
      project2.id,
    ]);

    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    
    const projectIds = res.body.map((item: any) => item.id);
    expect(projectIds).toContain(project1.id);
    expect(projectIds).not.toContain(project2.id);
  });

  it("limits results to 5 documents even when more exist", async () => {
    // Create 10 documents
    for (let i = 0; i < 10; i++) {
      await seedDoc({ title: `Doc ${i}` });
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
  });

  it("includes updated_at timestamp in response", async () => {
    await seedProject({ title: "Test Project" });

    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty("updated_at");
    expect(typeof res.body[0].updated_at).toBe("string");
  });

  it("handles mix of all document types correctly", async () => {
    await seedDoc({ title: "Doc" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await seedProject({ title: "Project" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await seedIssue({ title: "Issue" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await seedWeek({ title: "Week" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await seedTeam({ name: "Team" });

    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    
    const types = res.body.map((item: any) => item.type);
    expect(types).toContain("doc");
    expect(types).toContain("project");
    expect(types).toContain("issue");
    expect(types).toContain("week");
    expect(types).toContain("team");
  });

  it("returns empty array when all documents are soft-deleted", async () => {
    const project = await seedProject({ title: "Project" });
    const doc = await seedDoc({ title: "Doc" });
    const issue = await seedIssue({ title: "Issue" });

    // Soft delete all
    await pool.query("UPDATE projects SET deleted_at = NOW() WHERE id = $1", [project.id]);
    await pool.query("UPDATE docs SET deleted_at = NOW() WHERE id = $1", [doc.id]);
    await pool.query("UPDATE issues SET deleted_at = NOW() WHERE id = $1", [issue.id]);

    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("includes id field for all document types", async () => {
    await seedDoc({ title: "Doc" });
    await seedProject({ title: "Project" });
    await seedIssue({ title: "Issue" });

    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    
    res.body.forEach((item: any) => {
      expect(item).toHaveProperty("id");
      expect(typeof item.id).toBe("string");
    });
  });

  it("returns less than 5 documents when fewer exist", async () => {
    await seedDoc({ title: "Doc 1" });
    await seedProject({ title: "Project 1" });
    await seedIssue({ title: "Issue 1" });

    const res = await request(app).get("/api/dashboard/recent");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });
});
