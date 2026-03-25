import { describe, it, expect } from "vitest";
import {
  type Document,
  type CreateDocumentDTO,
  type UpdateDocumentDTO,
  type DocumentType,
  DOCUMENT_TYPES,
} from "../types.js";
import { createDocument } from "../factory.js";

describe("DocumentType", () => {
  it("has exactly 5 valid types", () => {
    expect(DOCUMENT_TYPES).toEqual(["doc", "issue", "project", "week", "team"]);
  });
});

describe("Document", () => {
  it("has all required fields", () => {
    const doc: Document = {
      id: "abc-123",
      title: "Test Doc",
      content: "Some content",
      document_type: "doc",
      created_at: "2026-03-25T00:00:00Z",
      updated_at: "2026-03-25T00:00:00Z",
      deleted_at: null,
    };
    expect(doc.id).toBe("abc-123");
    expect(doc.title).toBe("Test Doc");
    expect(doc.content).toBe("Some content");
    expect(doc.document_type).toBe("doc");
    expect(doc.created_at).toBeDefined();
    expect(doc.updated_at).toBeDefined();
    expect(doc.deleted_at).toBeNull();
  });

  it("deleted_at can be a string for soft-deleted docs", () => {
    const doc: Document = {
      id: "abc-123",
      title: "Deleted Doc",
      content: "",
      document_type: "issue",
      created_at: "2026-03-25T00:00:00Z",
      updated_at: "2026-03-25T00:00:00Z",
      deleted_at: "2026-03-25T01:00:00Z",
    };
    expect(doc.deleted_at).toBe("2026-03-25T01:00:00Z");
  });
});

describe("CreateDocumentDTO", () => {
  it("requires title and document_type, content is optional", () => {
    const dto: CreateDocumentDTO = {
      title: "New Doc",
      document_type: "project",
    };
    expect(dto.title).toBe("New Doc");
    expect(dto.document_type).toBe("project");
    // content is optional
    expect(dto.content).toBeUndefined();
  });

  it("accepts content when provided", () => {
    const dto: CreateDocumentDTO = {
      title: "New Doc",
      document_type: "doc",
      content: "Hello world",
    };
    expect(dto.content).toBe("Hello world");
  });
});

describe("UpdateDocumentDTO", () => {
  it("all fields are optional", () => {
    const dto: UpdateDocumentDTO = {};
    expect(dto.title).toBeUndefined();
    expect(dto.content).toBeUndefined();
  });

  it("accepts partial updates", () => {
    const dto: UpdateDocumentDTO = { title: "Updated Title" };
    expect(dto.title).toBe("Updated Title");
  });
});

describe("createDocument factory", () => {
  it("returns a valid Document with defaults", () => {
    const doc = createDocument({ title: "Factory Doc", document_type: "issue" });
    expect(doc.id).toBeDefined();
    expect(doc.title).toBe("Factory Doc");
    expect(doc.document_type).toBe("issue");
    expect(doc.content).toBe("");
    expect(doc.created_at).toBeDefined();
    expect(doc.updated_at).toBeDefined();
    expect(doc.deleted_at).toBeNull();
  });

  it("uses provided content", () => {
    const doc = createDocument({
      title: "With Content",
      document_type: "doc",
      content: "Body text",
    });
    expect(doc.content).toBe("Body text");
  });
});
