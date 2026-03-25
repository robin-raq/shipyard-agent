/**
 * Valid document types (kept for backward compatibility)
 */
export const DOCUMENT_TYPES = ["doc", "issue", "project", "week", "team"] as const;

/**
 * Document type union (kept for backward compatibility)
 */
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Main Document interface (kept for backward compatibility)
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
 * DTO for creating a new document (kept for backward compatibility)
 */
export interface CreateDocumentDTO {
  title: string;
  document_type: DocumentType;
  content?: string;
}

/**
 * DTO for updating an existing document (kept for backward compatibility)
 */
export interface UpdateDocumentDTO {
  title?: string;
  content?: string;
  document_type?: DocumentType;
}

// ============================================================================
// Entity-specific interfaces for separate-tables schema
// ============================================================================

/**
 * Doc entity
 */
export interface Doc {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Issue status enum
 */
export type IssueStatus = "open" | "in_progress" | "done" | "closed";

/**
 * Issue priority enum
 */
export type IssuePriority = "low" | "medium" | "high" | "critical";

/**
 * Issue entity
 */
export interface Issue {
  id: string;
  title: string;
  content: string;
  status: IssueStatus;
  priority: IssuePriority;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Project status enum
 */
export type ProjectStatus = "active" | "completed" | "archived";

/**
 * Project entity
 */
export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Week entity
 */
export interface Week {
  id: string;
  title: string;
  content: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Team entity
 */
export interface Team {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ============================================================================
// Create DTOs
// ============================================================================

/**
 * DTO for creating a new Doc
 */
export interface CreateDocDTO {
  title: string;
  content?: string;
}

/**
 * DTO for creating a new Issue
 */
export interface CreateIssueDTO {
  title: string;
  content?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  project_id?: string | null;
}

/**
 * DTO for creating a new Project
 */
export interface CreateProjectDTO {
  title: string;
  description?: string;
  status?: ProjectStatus;
}

/**
 * DTO for creating a new Week
 */
export interface CreateWeekDTO {
  title: string;
  content?: string;
  start_date: string;
  end_date: string;
}

/**
 * DTO for creating a new Team
 */
export interface CreateTeamDTO {
  name: string;
  description?: string;
}

// ============================================================================
// Update DTOs
// ============================================================================

/**
 * DTO for updating an existing Doc
 */
export interface UpdateDocDTO {
  title?: string;
  content?: string;
}

/**
 * DTO for updating an existing Issue
 */
export interface UpdateIssueDTO {
  title?: string;
  content?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  project_id?: string | null;
}

/**
 * DTO for updating an existing Project
 */
export interface UpdateProjectDTO {
  title?: string;
  description?: string;
  status?: ProjectStatus;
}

/**
 * DTO for updating an existing Week
 */
export interface UpdateWeekDTO {
  title?: string;
  content?: string;
  start_date?: string;
  end_date?: string;
}

/**
 * DTO for updating an existing Team
 */
export interface UpdateTeamDTO {
  name?: string;
  description?: string;
}
