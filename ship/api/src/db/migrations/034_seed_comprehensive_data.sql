-- Comprehensive seed data for all Ship features
-- Updates weeks with date ranges so my-week works
-- Adds demo data for all new features

DO $$
DECLARE
  dev_user_id UUID;
  week1_id UUID;
  week2_id UUID;
  team1_id UUID;
  project1_id UUID;
  issue1_id UUID;
  issue2_id UUID;
  issue3_id UUID;
BEGIN
  SELECT id INTO dev_user_id FROM users WHERE email = 'dev@ship.local';
  IF dev_user_id IS NULL THEN
    RAISE NOTICE 'Dev user not found, skipping seed data';
    RETURN;
  END IF;

  -- Fix weeks with actual date ranges (current week + last week)
  SELECT id INTO week1_id FROM weeks WHERE title = 'Week 1' LIMIT 1;
  IF week1_id IS NOT NULL THEN
    UPDATE weeks SET
      start_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT - 7),
      end_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT - 1)
    WHERE id = week1_id;
  END IF;

  SELECT id INTO week2_id FROM weeks WHERE title = 'Week 2' LIMIT 1;
  IF week2_id IS NOT NULL THEN
    UPDATE weeks SET
      start_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT),
      end_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT + 6)
    WHERE id = week2_id;
  END IF;

  -- If no weeks exist, create them
  IF week2_id IS NULL THEN
    INSERT INTO weeks (title, content, start_date, end_date)
    VALUES ('Current Week', 'Active sprint', CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT + 6)
    RETURNING id INTO week2_id;
  END IF;

  -- Ensure a team exists
  SELECT id INTO team1_id FROM teams LIMIT 1;
  IF team1_id IS NULL THEN
    INSERT INTO teams (title, content) VALUES ('Core Team', 'Ship development team')
    RETURNING id INTO team1_id;
  END IF;

  -- Ensure a project exists
  SELECT id INTO project1_id FROM projects LIMIT 1;
  IF project1_id IS NULL THEN
    INSERT INTO projects (title, content) VALUES ('Ship Platform', 'Main project management platform')
    RETURNING id INTO project1_id;
  END IF;

  -- Ensure some issues exist with various statuses
  SELECT id INTO issue1_id FROM issues WHERE title = 'Set up authentication' LIMIT 1;
  IF issue1_id IS NULL THEN
    INSERT INTO issues (title, content, status, priority)
    VALUES ('Set up authentication', 'Implement login/logout with session tokens', 'done', 'high')
    RETURNING id INTO issue1_id;
  END IF;

  SELECT id INTO issue2_id FROM issues WHERE title = 'Build kanban board' LIMIT 1;
  IF issue2_id IS NULL THEN
    INSERT INTO issues (title, content, status, priority, assignee_id)
    VALUES ('Build kanban board', 'Drag and drop issue board with 7 columns', 'in_progress', 'high', dev_user_id)
    RETURNING id INTO issue2_id;
  END IF;

  SELECT id INTO issue3_id FROM issues WHERE title = 'Add dark mode' LIMIT 1;
  IF issue3_id IS NULL THEN
    INSERT INTO issues (title, content, status, priority)
    VALUES ('Add dark mode', 'User-selectable dark mode theme', 'triage', 'low')
    RETURNING id INTO issue3_id;
  END IF;

  -- Add user profile fields
  UPDATE users SET
    title = 'Senior Engineer',
    department = 'Engineering',
    display_name = 'Dev User',
    bio = 'Full-stack developer working on the Ship platform.',
    location = 'San Francisco, CA'
  WHERE id = dev_user_id AND (title IS NULL OR title = '');

  -- Seed activity log
  INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_title)
  VALUES
    (dev_user_id, 'created', 'project', COALESCE(project1_id, gen_random_uuid()), 'Ship Platform'),
    (dev_user_id, 'created', 'issue', COALESCE(issue1_id, gen_random_uuid()), 'Set up authentication'),
    (dev_user_id, 'status_changed', 'issue', COALESCE(issue1_id, gen_random_uuid()), 'Set up authentication'),
    (dev_user_id, 'created', 'issue', COALESCE(issue2_id, gen_random_uuid()), 'Build kanban board'),
    (dev_user_id, 'assigned', 'issue', COALESCE(issue2_id, gen_random_uuid()), 'Build kanban board'),
    (dev_user_id, 'created', 'issue', COALESCE(issue3_id, gen_random_uuid()), 'Add dark mode')
  ON CONFLICT DO NOTHING;

  -- Seed notifications
  INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
  VALUES
    (dev_user_id, 'assignment', 'You were assigned an issue', 'Build kanban board has been assigned to you', 'issue', COALESCE(issue2_id, gen_random_uuid())),
    (dev_user_id, 'status_change', 'Issue completed', 'Set up authentication was marked as done', 'issue', COALESCE(issue1_id, gen_random_uuid())),
    (dev_user_id, 'comment', 'New comment on your issue', 'Great progress on the kanban board!', 'issue', COALESCE(issue2_id, gen_random_uuid()))
  ON CONFLICT DO NOTHING;

  -- Seed user settings
  INSERT INTO user_settings (user_id, theme, notifications_enabled, email_digest, default_view, timezone)
  VALUES (dev_user_id, 'light', true, 'daily', 'list', 'America/New_York')
  ON CONFLICT (user_id) DO NOTHING;

  -- Seed a sprint review for week 1
  IF week1_id IS NOT NULL THEN
    INSERT INTO sprint_reviews (week_id, author_id, summary, accomplishments, challenges, next_steps, team_rating, status, submitted_at)
    VALUES (week1_id, dev_user_id, 'Productive first week — shipped core features', 'Auth system, kanban board, 14 API routes, Railway deploy', 'Cross-boundary consistency between frontend and backend', 'Add contract extraction, build live evals, improve agent prompts', 4, 'submitted', NOW() - INTERVAL '3 days')
    ON CONFLICT (week_id, author_id) DO NOTHING;
  END IF;

  -- Seed iteration
  INSERT INTO iterations (name, team_id, start_date, end_date, goal, status)
  VALUES (
    'Sprint 1',
    team1_id,
    CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT,
    CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT + 13,
    'Ship core features: auth, issues, kanban, weekly planning',
    'active'
  ) ON CONFLICT DO NOTHING;

END $$;
