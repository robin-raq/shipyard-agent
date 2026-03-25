import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { runMigrations } from "../db/migrate.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://ship:ship@localhost:5433/ship_test";

let pool: pg.Pool;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  await runMigrations(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await pool.query("DELETE FROM documents");
});

describe("documents table", () => {
  it("exists after migration", async () => {
    const result = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'documents'"
    );
    expect(result.rows).toHaveLength(1);
  });

  it("has correct columns", async () => {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'documents'
       ORDER BY ordinal_position`
    );
    const columns = result.rows.map((r: { column_name: string }) => r.column_name);
    expect(columns).toContain("id");
    expect(columns).toContain("title");
    expect(columns).toContain("content");
    expect(columns).toContain("document_type");
    expect(columns).toContain("created_at");
    expect(columns).toContain("updated_at");
    expect(columns).toContain("deleted_at");
  });

  it("generates UUID for id on insert", async () => {
    const result = await pool.query(
      `INSERT INTO documents (title, content, document_type)
       VALUES ('Test', 'Content', 'doc') RETURNING *`
    );
    expect(result.rows[0].id).toBeDefined();
    expect(result.rows[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("sets timestamps automatically", async () => {
    const result = await pool.query(
      `INSERT INTO documents (title, content, document_type)
       VALUES ('Test', 'Content', 'issue') RETURNING *`
    );
    expect(result.rows[0].created_at).toBeDefined();
    expect(result.rows[0].updated_at).toBeDefined();
    expect(result.rows[0].deleted_at).toBeNull();
  });

  it("enforces valid document_type", async () => {
    await expect(
      pool.query(
        `INSERT INTO documents (title, content, document_type)
         VALUES ('Bad', 'Content', 'invalid_type')`
      )
    ).rejects.toThrow();
  });

  it("supports soft delete via deleted_at", async () => {
    const inserted = await pool.query(
      `INSERT INTO documents (title, content, document_type)
       VALUES ('To Delete', 'Content', 'doc') RETURNING id`
    );
    const id = inserted.rows[0].id;

    await pool.query(
      "UPDATE documents SET deleted_at = NOW() WHERE id = $1",
      [id]
    );

    const result = await pool.query(
      "SELECT deleted_at FROM documents WHERE id = $1",
      [id]
    );
    expect(result.rows[0].deleted_at).not.toBeNull();
  });
});
