-- Force-fix all issue statuses and re-apply constraint.
-- Previous migrations (012, 013, 019) may have been recorded as complete
-- but the constraint still fails. This migration has a fresh name so it
-- will always run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'issues'
  ) THEN
    -- Drop any existing constraint
    EXECUTE 'ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check';

    -- Convert every possible legacy status
    EXECUTE 'UPDATE issues SET status = ''triage'' WHERE status = ''open''';
    EXECUTE 'UPDATE issues SET status = ''cancelled'' WHERE status = ''closed''';
    EXECUTE 'UPDATE issues SET status = ''backlog'' WHERE status = ''blocked''';
    EXECUTE 'UPDATE issues SET status = ''backlog'' WHERE status = ''review''';
    EXECUTE 'UPDATE issues SET status = ''triage'' WHERE status IS NULL';
    EXECUTE 'UPDATE issues SET status = ''triage'' WHERE TRIM(status) = ''''';
    EXECUTE 'UPDATE issues SET status = ''in_progress'' WHERE status NOT IN (
      ''triage'', ''backlog'', ''todo'', ''in_progress'', ''in_review'', ''done'', ''cancelled''
    )';

    -- Now apply the constraint — all rows are guaranteed valid
    EXECUTE 'ALTER TABLE issues ADD CONSTRAINT issues_status_check CHECK (status IN (''triage'', ''backlog'', ''todo'', ''in_progress'', ''in_review'', ''done'', ''cancelled''))';

    -- Clear 013 and 019 from _migrations so they don't re-run and fail
    DELETE FROM _migrations WHERE name IN (
      '013_expand_issue_statuses_for_kanban.sql',
      '019_cleanup_rerun_blocked_migrations.sql'
    );
    -- Record them as done so they're skipped in future deploys
    INSERT INTO _migrations (name) VALUES ('013_expand_issue_statuses_for_kanban.sql') ON CONFLICT DO NOTHING;
    INSERT INTO _migrations (name) VALUES ('019_cleanup_rerun_blocked_migrations.sql') ON CONFLICT DO NOTHING;
  END IF;
END
$$;
