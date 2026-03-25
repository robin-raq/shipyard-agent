import { type Document, type CreateDocumentDTO } from "./types.js";
import { randomUUID } from "crypto";

/**
 * Factory function to create a Document from a CreateDocumentDTO
 */
export function createDocument(dto: CreateDocumentDTO): Document {
  const now = new Date().toISOString();
  
  return {
    id: randomUUID(),
    title: dto.title,
    content: dto.content ?? "",
    document_type: dto.document_type,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}
