-- Fix issue statuses BEFORE the constraint migration runs.
-- This migration runs first (012 < 013) and converts all non-standard
-- statuses to valid kanban values so the constraint can be applied.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'issues'
  ) THEN
    -- Drop the constraint first so we can update freely
    EXECUTE 'ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check';

    -- Map all legacy statuses to the new kanban set
    EXECUTE 'UPDATE issues SET status = ''triage'' WHERE status = ''open''';
    EXECUTE 'UPDATE issues SET status = ''cancelled'' WHERE status = ''closed''';
    EXECUTE 'UPDATE issues SET status = ''backlog'' WHERE status = ''blocked''';
    EXECUTE 'UPDATE issues SET status = ''backlog'' WHERE status = ''review''';

    -- Catch-all: anything not in the valid set gets mapped to in_progress
    EXECUTE 'UPDATE issues SET status = ''in_progress'' WHERE status NOT IN (
      ''triage'', ''backlog'', ''todo'', ''in_progress'', ''in_review'', ''done'', ''cancelled''
    )';

    -- Also remove the _migrations entries for 013 and 019 so they can re-run cleanly
    DELETE FROM _migrations WHERE name IN (
      '013_expand_issue_statuses_for_kanban.sql',
      '019_cleanup_rerun_blocked_migrations.sql'
    );
  END IF;
END
$$;
