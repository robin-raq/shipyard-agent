-- Expand issue statuses from 4 to 7 for kanban board
-- Make migration resilient if issues table does not exist in some environments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'issues'
  ) THEN
    -- 1) Drop existing constraint first (allows temporary invalid values)
    EXECUTE 'ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check';

    -- 2) Map old statuses to the new set BEFORE adding the new constraint
    EXECUTE 'UPDATE issues SET status = ''triage'' WHERE status = ''open''';
    EXECUTE 'UPDATE issues SET status = ''cancelled'' WHERE status = ''closed''';
    EXECUTE 'UPDATE issues SET status = ''backlog'' WHERE status = ''blocked''';
    EXECUTE 'UPDATE issues SET status = ''in_progress'' WHERE status NOT IN (''triage'', ''backlog'', ''todo'', ''in_progress'', ''in_review'', ''done'', ''cancelled'')';
    EXECUTE 'UPDATE issues SET status = ''triage'' WHERE status IS NULL';

    -- 3) Add the new constraint after data has been migrated
    EXECUTE 'ALTER TABLE issues ADD CONSTRAINT issues_status_check CHECK (status IN (''triage'', ''backlog'', ''todo'', ''in_progress'', ''in_review'', ''done'', ''cancelled''))';

    -- Add assignee support
    EXECUTE 'ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id) ON DELETE SET NULL';

    -- Performance indexes
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee_id)';
  END IF;
END
$$;