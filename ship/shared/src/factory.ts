import type { Document, CreateDocumentDTO } from "./types.js";

export function createDocument(dto: CreateDocumentDTO): Document {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: dto.title,
    content: dto.content ?? "",
    document_type: dto.document_type,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}
