// Backward compatibility exports
export {
  type Document,
  type CreateDocumentDTO,
  type UpdateDocumentDTO,
  type DocumentType,
  DOCUMENT_TYPES,
} from "./types.js";

export { createDocument } from "./factory.js";

// Entity-specific exports
export {
  type Doc,
  type Issue,
  type IssueStatus,
  type IssuePriority,
  type Project,
  type ProjectStatus,
  type Week,
  type Team,
  type CreateDocDTO,
  type CreateIssueDTO,
  type CreateProjectDTO,
  type CreateWeekDTO,
  type CreateTeamDTO,
  type UpdateDocDTO,
  type UpdateIssueDTO,
  type UpdateProjectDTO,
  type UpdateWeekDTO,
  type UpdateTeamDTO,
} from "./types.js";

export {
  createDoc,
  createIssue,
  createProject,
  createWeek,
  createTeam,
} from "./factory.js";
