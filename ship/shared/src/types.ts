/**
 * Valid document types
 */
export const DOCUMENT_TYPES = ["doc", "issue", "project", "week", "team"] as const;

/**
 * Document type union
 */
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Main Document interface
 */
export interface Document {
  id: string;
  title: string;
  content: string;
  document_type: DocumentType;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * DTO for creating a new document
 */
export interface CreateDocumentDTO {
  title: string;
  document_type: DocumentType;
  content?: string;
}

/**
 * DTO for updating an existing document
 */
export interface UpdateDocumentDTO {
  title?: string;
  content?: string;
  document_type?: DocumentType;
}
