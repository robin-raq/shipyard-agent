-- Expand issue statuses from 4 to 7 for kanban board
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check CHECK (status IN ('triage', 'backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'));

-- Map old statuses to new ones
UPDATE issues SET status = 'triage' WHERE status = 'open';
UPDATE issues SET status = 'cancelled' WHERE status = 'closed';

-- Add assignee support
ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee_id);
