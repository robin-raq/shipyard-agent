import { 
  type Document, 
  type CreateDocumentDTO,
  type Doc,
  type Issue,
  type Project,
  type Week,
  type Team,
  type CreateDocDTO,
  type CreateIssueDTO,
  type CreateProjectDTO,
  type CreateWeekDTO,
  type CreateTeamDTO,
} from "./types.js";
import { randomUUID } from "crypto";

/**
 * Factory function to create a Document from a CreateDocumentDTO
 * (kept for backward compatibility)
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

// ============================================================================
// Entity-specific factory functions
// ============================================================================

/**
 * Factory function to create a Doc from a CreateDocDTO
 */
export function createDoc(dto: CreateDocDTO): Doc {
  const now = new Date().toISOString();
  
  return {
    id: randomUUID(),
    title: dto.title,
    content: dto.content ?? "",
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

/**
 * Factory function to create an Issue from a CreateIssueDTO
 */
export function createIssue(dto: CreateIssueDTO): Issue {
  const now = new Date().toISOString();
  
  return {
    id: randomUUID(),
    title: dto.title,
    content: dto.content ?? "",
    status: dto.status ?? "open",
    priority: dto.priority ?? "medium",
    project_id: dto.project_id ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

/**
 * Factory function to create a Project from a CreateProjectDTO
 */
export function createProject(dto: CreateProjectDTO): Project {
  const now = new Date().toISOString();
  
  return {
    id: randomUUID(),
    title: dto.title,
    description: dto.description ?? "",
    status: dto.status ?? "active",
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

/**
 * Factory function to create a Week from a CreateWeekDTO
 */
export function createWeek(dto: CreateWeekDTO): Week {
  const now = new Date().toISOString();
  
  return {
    id: randomUUID(),
    title: dto.title,
    content: dto.content ?? "",
    start_date: dto.start_date,
    end_date: dto.end_date,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

/**
 * Factory function to create a Team from a CreateTeamDTO
 */
export function createTeam(dto: CreateTeamDTO): Team {
  const now = new Date().toISOString();
  
  return {
    id: randomUUID(),
    name: dto.name,
    description: dto.description ?? "",
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}
