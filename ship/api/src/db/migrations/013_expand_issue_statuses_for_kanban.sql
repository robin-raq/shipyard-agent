-- Expand issue statuses from 4 to 7 for kanban board
DO $body$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'issues'
  ) THEN
    EXECUTE 'ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check';
    EXECUTE 'UPDATE issues SET status = ''triage'' WHERE status = ''open''';
    EXECUTE 'UPDATE issues SET status = ''cancelled'' WHERE status = ''closed''';
    EXECUTE 'UPDATE issues SET status = ''backlog'' WHERE status = ''blocked''';
    EXECUTE 'UPDATE issues SET status = ''triage'' WHERE status IS NULL';
    EXECUTE 'UPDATE issues SET status = ''in_progress'' WHERE status NOT IN (''triage'', ''backlog'', ''todo'', ''in_progress'', ''in_review'', ''done'', ''cancelled'')';
    EXECUTE 'ALTER TABLE issues ADD CONSTRAINT issues_status_check CHECK (status IN (''triage'', ''backlog'', ''todo'', ''in_progress'', ''in_review'', ''done'', ''cancelled''))';
    EXECUTE 'ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee_id)';
  END IF;
END
$body$;
