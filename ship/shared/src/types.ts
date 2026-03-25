export const DOCUMENT_TYPES = [
  "doc",
  "issue",
  "project",
  "week",
  "team",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface Document {
  id: string;
  title: string;
  content: string;
  document_type: DocumentType;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateDocumentDTO {
  title: string;
  document_type: DocumentType;
  content?: string;
}

export interface UpdateDocumentDTO {
  title?: string;
  content?: string;
}
