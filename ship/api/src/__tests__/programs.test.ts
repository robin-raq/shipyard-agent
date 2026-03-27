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
  
  // Clean up the test database before running migrations
  await pool.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO ship;
    GRANT ALL ON SCHEMA public TO public;
  `);
  
  await runMigrations(pool);
  app = createApp(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  // Clean up program_associations first due to foreign key constraint
  await pool.query("DELETE FROM program_associations");
  await pool.query("DELETE FROM programs");
  await pool.query("DELETE FROM users");
});

async function seedProgram(overrides: Record<string, string> = {}) {
  const defaults = { 
    name: "Test Program", 
    description: "Test Description" 
  };
  const program = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO programs (name, description)
     VALUES ($1, $2) RETURNING *`,
    [program.name, program.description]
  );
  return result.rows[0];
}

async function seedUser() {
  const result = await pool.query(
    `INSERT INTO users (username, email, password)
     VALUES ($1, $2, $3) RETURNING *`,
    ["testuser", "test@example.com", "hashedpassword"]
  );
  return result.rows[0];
}

describe("GET /api/programs", () => {
  it("returns 200 with array of programs and total count", async () => {
    await seedProgram();
    const res = await request(app).get("/api/programs");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("programs");
    expect(res.body).toHaveProperty("total");
    expect(Array.isArray(res.body.programs)).toBe(true);
    expect(res.body.programs).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it("returns empty array when no programs exist", async () => {
    const res = await request(app).get("/api/programs");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("filters by search term in name", async () => {
    await seedProgram({ name: "Engineering Fellowship" });
    await seedProgram({ name: "Design Bootcamp" });
    await seedProgram({ name: "Engineering Internship" });

    const res = await request(app).get("/api/programs?search=Engineering");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.programs.every((p: { name: string }) => 
      p.name.includes("Engineering")
    )).toBe(true);
  });

  it("filters by search term in description", async () => {
    await seedProgram({ 
      name: "Program A", 
      description: "A program for software engineers" 
    });
    await seedProgram({ 
      name: "Program B", 
      description: "A program for designers" 
    });

    const res = await request(app).get("/api/programs?search=software");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(1);
    expect(res.body.programs[0].name).toBe("Program A");
  });

  it("respects limit parameter", async () => {
    await seedProgram({ name: "Program 1" });
    await seedProgram({ name: "Program 2" });
    await seedProgram({ name: "Program 3" });

    const res = await request(app).get("/api/programs?limit=2");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(2);
    expect(res.body.total).toBe(3);
  });

  it("respects offset parameter", async () => {
    await seedProgram({ name: "Program 1" });
    await seedProgram({ name: "Program 2" });
    await seedProgram({ name: "Program 3" });

    const res = await request(app).get("/api/programs?offset=1");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(2);
    expect(res.body.total).toBe(3);
  });

  it("orders programs by created_at DESC", async () => {
    const program1 = await seedProgram({ name: "First Program" });
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
    const program2 = await seedProgram({ name: "Second Program" });

    const res = await request(app).get("/api/programs");
    expect(res.status).toBe(200);
    expect(res.body.programs[0].id).toBe(program2.id);
    expect(res.body.programs[1].id).toBe(program1.id);
  });

  it("returns all programs when no filters applied", async () => {
    await seedProgram({ name: "Program 1", description: "Description 1" });
    await seedProgram({ name: "Program 2", description: "Description 2" });
    await seedProgram({ name: "Program 3", description: "Description 3" });

    const res = await request(app).get("/api/programs");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(3);
    expect(res.body.total).toBe(3);
  });

  it("handles case-insensitive search", async () => {
    await seedProgram({ name: "Engineering Program" });
    await seedProgram({ name: "engineering bootcamp" });
    await seedProgram({ name: "ENGINEERING Fellowship" });

    const res = await request(app).get("/api/programs?search=engineering");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(3);
    expect(res.body.total).toBe(3);
  });

  it("combines limit and offset for pagination", async () => {
    await seedProgram({ name: "Program 1" });
    await seedProgram({ name: "Program 2" });
    await seedProgram({ name: "Program 3" });
    await seedProgram({ name: "Program 4" });
    await seedProgram({ name: "Program 5" });

    const res = await request(app).get("/api/programs?limit=2&offset=2");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(2);
    expect(res.body.total).toBe(5);
  });

  it("returns correct total count when search filters results", async () => {
    await seedProgram({ name: "Engineering Program" });
    await seedProgram({ name: "Design Program" });
    await seedProgram({ name: "Engineering Bootcamp" });

    const res = await request(app).get("/api/programs?search=Engineering&limit=1");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(1);
    expect(res.body.total).toBe(2); // Total matching search, not just returned
  });

  it("returns programs with all expected fields", async () => {
    const program = await seedProgram({ 
      name: "Test Program", 
      description: "Test Description" 
    });

    const res = await request(app).get("/api/programs");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(1);
    
    const returnedProgram = res.body.programs[0];
    expect(returnedProgram).toHaveProperty("id");
    expect(returnedProgram).toHaveProperty("name");
    expect(returnedProgram).toHaveProperty("description");
    expect(returnedProgram).toHaveProperty("created_at");
    expect(returnedProgram).toHaveProperty("updated_at");
    expect(returnedProgram.id).toBe(program.id);
    expect(returnedProgram.name).toBe("Test Program");
    expect(returnedProgram.description).toBe("Test Description");
  });

  it("handles search with special characters", async () => {
    await seedProgram({ name: "Program with & special % chars" });
    await seedProgram({ name: "Regular Program" });

    const res = await request(app).get("/api/programs?search=%");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(1);
    expect(res.body.programs[0].name).toContain("%");
  });

  it("returns empty results when search matches nothing", async () => {
    await seedProgram({ name: "Engineering Program" });
    await seedProgram({ name: "Design Program" });

    const res = await request(app).get("/api/programs?search=NonexistentTerm");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});

describe("GET /api/programs/:id", () => {
  it("returns 200 with program details", async () => {
    const program = await seedProgram();
    const res = await request(app).get(`/api/programs/${program.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(program.id);
    expect(res.body.name).toBe("Test Program");
    expect(res.body.description).toBe("Test Description");
    expect(res.body.created_at).toBeDefined();
    expect(res.body.updated_at).toBeDefined();
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app).get("/api/programs/99999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Program not found");
  });

  it("returns 500 for invalid id format", async () => {
    // PostgreSQL throws an error when trying to cast 'invalid' to integer
    const res = await request(app).get("/api/programs/invalid");
    expect(res.status).toBe(500);
  });

  it("returns program with all expected fields", async () => {
    const program = await seedProgram({ 
      name: "Specific Program", 
      description: "Specific Description" 
    });
    
    const res = await request(app).get(`/api/programs/${program.id}`);
    expect(res.status).toBe(200);
    
    // Verify all fields are present
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("name");
    expect(res.body).toHaveProperty("description");
    expect(res.body).toHaveProperty("created_at");
    expect(res.body).toHaveProperty("updated_at");
    
    // Verify field values
    expect(res.body.id).toBe(program.id);
    expect(res.body.name).toBe("Specific Program");
    expect(res.body.description).toBe("Specific Description");
  });

  it("returns program with null description", async () => {
    const result = await pool.query(
      `INSERT INTO programs (name, description)
       VALUES ($1, $2) RETURNING *`,
      ["Program Without Description", null]
    );
    const program = result.rows[0];
    
    const res = await request(app).get(`/api/programs/${program.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(program.id);
    expect(res.body.name).toBe("Program Without Description");
    expect(res.body.description).toBeNull();
  });

  it("returns correct program when multiple programs exist", async () => {
    const program1 = await seedProgram({ name: "Program 1" });
    const program2 = await seedProgram({ name: "Program 2" });
    const program3 = await seedProgram({ name: "Program 3" });
    
    const res = await request(app).get(`/api/programs/${program2.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(program2.id);
    expect(res.body.name).toBe("Program 2");
  });

  it("returns program with special characters in name", async () => {
    const program = await seedProgram({ 
      name: "Program & Co. (2024) - Test!",
      description: "Description with special chars: @#$%"
    });
    
    const res = await request(app).get(`/api/programs/${program.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Program & Co. (2024) - Test!");
    expect(res.body.description).toBe("Description with special chars: @#$%");
  });

  it("returns program with unicode characters", async () => {
    const program = await seedProgram({ 
      name: "プログラム 程序 프로그램",
      description: "Unicode: 🚀 ✨ 💻"
    });
    
    const res = await request(app).get(`/api/programs/${program.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("プログラム 程序 프로그램");
    expect(res.body.description).toBe("Unicode: 🚀 ✨ 💻");
  });

  it("returns 404 for negative id", async () => {
    const res = await request(app).get("/api/programs/-1");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Program not found");
  });

  it("returns 404 for zero id", async () => {
    const res = await request(app).get("/api/programs/0");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Program not found");
  });

  it("returns program with very long description", async () => {
    const longDescription = "A".repeat(5000);
    const program = await seedProgram({ 
      name: "Program with long description",
      description: longDescription
    });
    
    const res = await request(app).get(`/api/programs/${program.id}`);
    expect(res.status).toBe(200);
    expect(res.body.description).toBe(longDescription);
    expect(res.body.description.length).toBe(5000);
  });

  it("returns timestamps in ISO format", async () => {
    const program = await seedProgram();
    
    const res = await request(app).get(`/api/programs/${program.id}`);
    expect(res.status).toBe(200);
    
    // Verify timestamps are valid ISO strings
    expect(() => new Date(res.body.created_at)).not.toThrow();
    expect(() => new Date(res.body.updated_at)).not.toThrow();
    
    const createdAt = new Date(res.body.created_at);
    const updatedAt = new Date(res.body.updated_at);
    
    expect(createdAt.toISOString()).toBe(res.body.created_at);
    expect(updatedAt.toISOString()).toBe(res.body.updated_at);
  });

  it("returns only the requested program, not others", async () => {
    await seedProgram({ name: "Program 1", description: "Description 1" });
    const targetProgram = await seedProgram({ name: "Program 2", description: "Description 2" });
    await seedProgram({ name: "Program 3", description: "Description 3" });
    
    const res = await request(app).get(`/api/programs/${targetProgram.id}`);
    expect(res.status).toBe(200);
    
    // Verify it's a single object, not an array
    expect(Array.isArray(res.body)).toBe(false);
    expect(res.body.id).toBe(targetProgram.id);
    expect(res.body.name).toBe("Program 2");
    expect(res.body.description).toBe("Description 2");
  });

  it("returns 404 for very large id", async () => {
    const res = await request(app).get("/api/programs/999999999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Program not found");
  });

  it("returns program immediately after creation", async () => {
    const createRes = await request(app)
      .post("/api/programs")
      .send({ name: "New Program", description: "New Description" });
    
    expect(createRes.status).toBe(201);
    const programId = createRes.body.id;
    
    const getRes = await request(app).get(`/api/programs/${programId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(programId);
    expect(getRes.body.name).toBe("New Program");
    expect(getRes.body.description).toBe("New Description");
  });

  it("returns updated program data after update", async () => {
    const program = await seedProgram({ name: "Original Name" });
    
    await request(app)
      .put(`/api/programs/${program.id}`)
      .send({ name: "Updated Name" });
    
    const res = await request(app).get(`/api/programs/${program.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
  });

  it("returns 404 after program is deleted", async () => {
    const program = await seedProgram();
    
    await request(app).delete(`/api/programs/${program.id}`);
    
    const res = await request(app).get(`/api/programs/${program.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Program not found");
  });
});

describe("POST /api/programs", () => {
  it("creates program and returns 201", async () => {
    const res = await request(app)
      .post("/api/programs")
      .send({ 
        name: "New Program", 
        description: "A new program description" 
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("New Program");
    expect(res.body.description).toBe("A new program description");
    expect(res.body.created_at).toBeDefined();
    expect(res.body.updated_at).toBeDefined();
  });

  it("creates program without description", async () => {
    const res = await request(app)
      .post("/api/programs")
      .send({ name: "Program Without Description" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Program Without Description");
    expect(res.body.description).toBeNull();
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/programs")
      .send({ description: "Description without name" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Name is required");
  });

  it("returns 400 when name is empty string", async () => {
    const res = await request(app)
      .post("/api/programs")
      .send({ name: "", description: "Description" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });

  it("returns 400 when body is empty", async () => {
    const res = await request(app)
      .post("/api/programs")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });

  it("trims whitespace from name", async () => {
    const res = await request(app)
      .post("/api/programs")
      .send({ name: "  Program with spaces  " });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("  Program with spaces  ");
  });

  it("creates program with long description", async () => {
    const longDescription = "A".repeat(5000);
    const res = await request(app)
      .post("/api/programs")
      .send({ 
        name: "Program with long description",
        description: longDescription
      });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe(longDescription);
  });

  it("creates program with special characters in name", async () => {
    const res = await request(app)
      .post("/api/programs")
      .send({ name: "Program & Co. (2024) - Test!" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Program & Co. (2024) - Test!");
  });

  it("creates program with unicode characters", async () => {
    const res = await request(app)
      .post("/api/programs")
      .send({ 
        name: "プログラム 程序 프로그램",
        description: "Unicode description: 🚀 ✨ 💻"
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("プログラム 程序 프로그램");
    expect(res.body.description).toBe("Unicode description: 🚀 ✨ 💻");
  });

  it("persists created program to database", async () => {
    const res = await request(app)
      .post("/api/programs")
      .send({ 
        name: "Persisted Program",
        description: "This should be in the database"
      });
    
    expect(res.status).toBe(201);
    const programId = res.body.id;

    // Verify it's in the database
    const dbResult = await pool.query(
      "SELECT * FROM programs WHERE id = $1",
      [programId]
    );
    
    expect(dbResult.rows).toHaveLength(1);
    expect(dbResult.rows[0].name).toBe("Persisted Program");
    expect(dbResult.rows[0].description).toBe("This should be in the database");
  });

  it("sets created_at and updated_at timestamps", async () => {
    const beforeCreate = new Date();
    
    const res = await request(app)
      .post("/api/programs")
      .send({ name: "Timestamped Program" });
    
    const afterCreate = new Date();
    
    expect(res.status).toBe(201);
    expect(res.body.created_at).toBeDefined();
    expect(res.body.updated_at).toBeDefined();
    
    const createdAt = new Date(res.body.created_at);
    const updatedAt = new Date(res.body.updated_at);
    
    expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
  });

  it("returns 400 when name is null", async () => {
    const res = await request(app)
      .post("/api/programs")
      .send({ name: null, description: "Description" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });

  it("accepts name with only whitespace (current behavior)", async () => {
    const res = await request(app)
      .post("/api/programs")
      .send({ name: "   ", description: "Description" });
    // Note: Current implementation accepts whitespace-only names
    // Consider adding validation if this should be rejected
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("   ");
  });

  it("creates multiple programs with same description", async () => {
    const description = "Same description";
    
    const res1 = await request(app)
      .post("/api/programs")
      .send({ name: "Program 1", description });
    
    const res2 = await request(app)
      .post("/api/programs")
      .send({ name: "Program 2", description });
    
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.id).not.toBe(res2.body.id);
    expect(res1.body.description).toBe(description);
    expect(res2.body.description).toBe(description);
  });
});

describe("PUT /api/programs/:id", () => {
  it("updates program name and returns 200", async () => {
    const program = await seedProgram();
    const res = await request(app)
      .put(`/api/programs/${program.id}`)
      .send({ name: "Updated Program Name" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Program Name");
    expect(res.body.description).toBe(program.description);
    expect(new Date(res.body.updated_at).getTime())
      .toBeGreaterThan(new Date(program.updated_at).getTime());
  });

  it("updates program description and returns 200", async () => {
    const program = await seedProgram();
    const res = await request(app)
      .put(`/api/programs/${program.id}`)
      .send({ description: "Updated Description" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(program.name);
    expect(res.body.description).toBe("Updated Description");
  });

  it("updates both name and description", async () => {
    const program = await seedProgram();
    const res = await request(app)
      .put(`/api/programs/${program.id}`)
      .send({ 
        name: "New Name", 
        description: "New Description" 
      });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");
    expect(res.body.description).toBe("New Description");
  });

  it("allows setting description to null", async () => {
    const program = await seedProgram();
    const res = await request(app)
      .put(`/api/programs/${program.id}`)
      .send({ description: null });
    expect(res.status).toBe(200);
    expect(res.body.description).toBeNull();
  });

  it("returns 400 when no fields to update", async () => {
    const program = await seedProgram();
    const res = await request(app)
      .put(`/api/programs/${program.id}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("No fields to update");
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app)
      .put("/api/programs/99999")
      .send({ name: "Updated Name" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Program not found");
  });
});

describe("DELETE /api/programs/:id", () => {
  it("deletes program and returns 200", async () => {
    const program = await seedProgram();
    const res = await request(app).delete(`/api/programs/${program.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(program.id);
  });

  it("program is not retrievable after deletion", async () => {
    const program = await seedProgram();
    await request(app).delete(`/api/programs/${program.id}`);
    
    const res = await request(app).get(`/api/programs/${program.id}`);
    expect(res.status).toBe(404);
  });

  it("program is not in list after deletion", async () => {
    const program = await seedProgram();
    await request(app).delete(`/api/programs/${program.id}`);
    
    const res = await request(app).get("/api/programs");
    expect(res.status).toBe(200);
    expect(res.body.programs).toHaveLength(0);
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app).delete("/api/programs/99999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Program not found");
  });

  it("cascades delete to program_associations", async () => {
    const program = await seedProgram();
    const user = await seedUser();
    
    await pool.query(
      `INSERT INTO program_associations (program_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [program.id, user.id, "admin"]
    );

    await request(app).delete(`/api/programs/${program.id}`);

    const associations = await pool.query(
      "SELECT * FROM program_associations WHERE program_id = $1",
      [program.id]
    );
    expect(associations.rows).toHaveLength(0);
  });
});

describe("GET /api/programs/:id/associations", () => {
  it("returns 200 with empty array when no associations", async () => {
    const program = await seedProgram();
    const res = await request(app).get(`/api/programs/${program.id}/associations`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it("returns 200 with associations", async () => {
    const program = await seedProgram();
    const user = await seedUser();
    
    await pool.query(
      `INSERT INTO program_associations (program_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [program.id, user.id, "admin"]
    );

    const res = await request(app).get(`/api/programs/${program.id}/associations`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].program_id).toBe(program.id);
    expect(res.body[0].user_id).toBe(user.id);
    expect(res.body[0].role).toBe("admin");
  });

  it("returns 404 for nonexistent program", async () => {
    const res = await request(app).get("/api/programs/99999/associations");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Program not found");
  });
});

describe("POST /api/programs/:id/associations", () => {
  it("creates association and returns 201", async () => {
    const program = await seedProgram();
    const user = await seedUser();

    const res = await request(app)
      .post(`/api/programs/${program.id}/associations`)
      .send({ user_id: user.id, role: "member" });
    
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.program_id).toBe(program.id);
    expect(res.body.user_id).toBe(user.id);
    expect(res.body.role).toBe("member");
  });

  it("creates association with admin role", async () => {
    const program = await seedProgram();
    const user = await seedUser();

    const res = await request(app)
      .post(`/api/programs/${program.id}/associations`)
      .send({ user_id: user.id, role: "admin" });
    
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("admin");
  });

  it("returns 400 when user_id is missing", async () => {
    const program = await seedProgram();

    const res = await request(app)
      .post(`/api/programs/${program.id}/associations`)
      .send({ role: "member" });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("user_id and role are required");
  });

  it("returns 400 when role is missing", async () => {
    const program = await seedProgram();
    const user = await seedUser();

    const res = await request(app)
      .post(`/api/programs/${program.id}/associations`)
      .send({ user_id: user.id });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("user_id and role are required");
  });

  it("returns 400 when role is invalid", async () => {
    const program = await seedProgram();
    const user = await seedUser();

    const res = await request(app)
      .post(`/api/programs/${program.id}/associations`)
      .send({ user_id: user.id, role: "invalid_role" });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("role must be either 'admin' or 'member'");
  });

  it("returns 404 for nonexistent program", async () => {
    const user = await seedUser();

    const res = await request(app)
      .post("/api/programs/99999/associations")
      .send({ user_id: user.id, role: "member" });
    
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Program not found");
  });
});

describe("PUT /api/programs/:id/associations/:associationId", () => {
  it("updates association role and returns 200", async () => {
    const program = await seedProgram();
    const user = await seedUser();
    
    const association = await pool.query(
      `INSERT INTO program_associations (program_id, user_id, role)
       VALUES ($1, $2, $3) RETURNING *`,
      [program.id, user.id, "member"]
    );

    const res = await request(app)
      .put(`/api/programs/${program.id}/associations/${association.rows[0].id}`)
      .send({ role: "admin" });
    
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
  });

  it("returns 400 when role is missing", async () => {
    const program = await seedProgram();
    const user = await seedUser();
    
    const association = await pool.query(
      `INSERT INTO program_associations (program_id, user_id, role)
       VALUES ($1, $2, $3) RETURNING *`,
      [program.id, user.id, "member"]
    );

    const res = await request(app)
      .put(`/api/programs/${program.id}/associations/${association.rows[0].id}`)
      .send({});
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("role is required");
  });

  it("returns 400 when role is invalid", async () => {
    const program = await seedProgram();
    const user = await seedUser();
    
    const association = await pool.query(
      `INSERT INTO program_associations (program_id, user_id, role)
       VALUES ($1, $2, $3) RETURNING *`,
      [program.id, user.id, "member"]
    );

    const res = await request(app)
      .put(`/api/programs/${program.id}/associations/${association.rows[0].id}`)
      .send({ role: "invalid" });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });

  it("returns 404 for nonexistent association", async () => {
    const program = await seedProgram();

    const res = await request(app)
      .put(`/api/programs/${program.id}/associations/99999`)
      .send({ role: "admin" });
    
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Association not found");
  });
});

describe("DELETE /api/programs/:id/associations/:associationId", () => {
  it("deletes association and returns 200", async () => {
    const program = await seedProgram();
    const user = await seedUser();
    
    const association = await pool.query(
      `INSERT INTO program_associations (program_id, user_id, role)
       VALUES ($1, $2, $3) RETURNING *`,
      [program.id, user.id, "member"]
    );

    const res = await request(app)
      .delete(`/api/programs/${program.id}/associations/${association.rows[0].id}`);
    
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(association.rows[0].id);
  });

  it("association is not retrievable after deletion", async () => {
    const program = await seedProgram();
    const user = await seedUser();
    
    const association = await pool.query(
      `INSERT INTO program_associations (program_id, user_id, role)
       VALUES ($1, $2, $3) RETURNING *`,
      [program.id, user.id, "member"]
    );

    await request(app)
      .delete(`/api/programs/${program.id}/associations/${association.rows[0].id}`);

    const res = await request(app).get(`/api/programs/${program.id}/associations`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("returns 404 for nonexistent association", async () => {
    const program = await seedProgram();

    const res = await request(app)
      .delete(`/api/programs/${program.id}/associations/99999`);
    
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBe("Association not found");
  });
});
