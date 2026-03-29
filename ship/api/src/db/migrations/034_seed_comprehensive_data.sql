-- Comprehensive seed data for ALL Ship features
-- Each section is wrapped in its own exception handler so failures don't cascade

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
  issue4_id UUID;
  issue5_id UUID;
  issue6_id UUID;
  doc1_id UUID;
  doc2_id UUID;
  ship1_id UUID;
BEGIN
  -- Get dev user
  SELECT id INTO dev_user_id FROM users WHERE email = 'dev@ship.local';
  IF dev_user_id IS NULL THEN
    RAISE NOTICE 'Dev user not found, skipping seed data';
    RETURN;
  END IF;

  -- ============================================================
  -- WEEKS — set actual date ranges so my-week route works
  -- ============================================================
  BEGIN
    UPDATE weeks SET
      start_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT - 7)::DATE,
      end_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT - 1)::DATE
    WHERE title = 'Week 1' AND (start_date IS NULL);

    UPDATE weeks SET
      start_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT)::DATE,
      end_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT + 6)::DATE
    WHERE title = 'Week 2' AND (start_date IS NULL);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Weeks date update skipped: %', SQLERRM;
  END;

  SELECT id INTO week1_id FROM weeks WHERE title = 'Week 1' LIMIT 1;
  SELECT id INTO week2_id FROM weeks WHERE title = 'Week 2' LIMIT 1;

  -- ============================================================
  -- TEAMS — ensure at least one team exists
  -- ============================================================
  BEGIN
    SELECT id INTO team1_id FROM teams WHERE deleted_at IS NULL LIMIT 1;
    IF team1_id IS NULL THEN
      INSERT INTO teams (title, content) VALUES ('Engineering', 'Core engineering team')
      RETURNING id INTO team1_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Teams seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- PROJECTS — ensure projects exist
  -- ============================================================
  BEGIN
    SELECT id INTO project1_id FROM projects WHERE deleted_at IS NULL LIMIT 1;
    IF project1_id IS NULL THEN
      INSERT INTO projects (title, content) VALUES ('Ship Platform', 'Main project management application')
      RETURNING id INTO project1_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Projects seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- ISSUES — various statuses for kanban board demo
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM issues WHERE title = 'Set up authentication') THEN
      INSERT INTO issues (title, content, status, priority, assignee_id)
      VALUES ('Set up authentication', 'Implement login/logout with session tokens', 'done', 'high', dev_user_id)
      RETURNING id INTO issue1_id;
    ELSE
      SELECT id INTO issue1_id FROM issues WHERE title = 'Set up authentication' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM issues WHERE title = 'Build kanban board') THEN
      INSERT INTO issues (title, content, status, priority, assignee_id)
      VALUES ('Build kanban board', 'Drag and drop issue board with 7 columns', 'in_progress', 'high', dev_user_id)
      RETURNING id INTO issue2_id;
    ELSE
      SELECT id INTO issue2_id FROM issues WHERE title = 'Build kanban board' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM issues WHERE title = 'Add dark mode') THEN
      INSERT INTO issues (title, content, status, priority)
      VALUES ('Add dark mode', 'User-selectable dark mode theme', 'triage', 'low')
      RETURNING id INTO issue3_id;
    ELSE
      SELECT id INTO issue3_id FROM issues WHERE title = 'Add dark mode' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM issues WHERE title = 'Design system cleanup') THEN
      INSERT INTO issues (title, content, status, priority)
      VALUES ('Design system cleanup', 'Standardize component styling across the app', 'backlog', 'medium');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM issues WHERE title = 'API rate limiting') THEN
      INSERT INTO issues (title, content, status, priority)
      VALUES ('API rate limiting', 'Add rate limiting to prevent abuse', 'todo', 'high');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM issues WHERE title = 'Mobile responsive layout') THEN
      INSERT INTO issues (title, content, status, priority)
      VALUES ('Mobile responsive layout', 'Make all pages responsive for mobile devices', 'in_review', 'medium');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Issues seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- DOCUMENTS — ensure docs page has data
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM docs WHERE title = 'Getting Started Guide') THEN
      INSERT INTO docs (title, content)
      VALUES ('Getting Started Guide', 'This guide helps you get started with Ship. Follow these steps to set up your workspace.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM docs WHERE title = 'API Documentation') THEN
      INSERT INTO docs (title, content)
      VALUES ('API Documentation', 'Complete API reference for the Ship platform. All endpoints require authentication via x-session-token header.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Docs seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- SHIPS — ensure ships page has data
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM ships WHERE title = 'v1.0 Launch') THEN
      INSERT INTO ships (title, content)
      VALUES ('v1.0 Launch', 'Initial release with core features: issues, kanban, weekly planning');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM ships WHERE title = 'v1.1 FleetGraph Integration') THEN
      INSERT INTO ships (title, content)
      VALUES ('v1.1 FleetGraph Integration', 'Add project intelligence agent with proactive monitoring');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Ships seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- USER PROFILE — populate profile fields
  -- ============================================================
  BEGIN
    UPDATE users SET
      title = COALESCE(NULLIF(title, ''), 'Senior Engineer'),
      department = COALESCE(NULLIF(department, ''), 'Engineering'),
      display_name = COALESCE(NULLIF(display_name, ''), 'Dev User'),
      bio = COALESCE(NULLIF(bio, ''), 'Full-stack developer building the Ship platform. Passionate about developer tools and project management.'),
      location = COALESCE(NULLIF(location, ''), 'San Francisco, CA')
    WHERE id = dev_user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Profile update skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- ACTIVITY LOG — populate activity page
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM activity_log WHERE user_id = dev_user_id LIMIT 1) THEN
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_title, created_at) VALUES
        (dev_user_id, 'created', 'project', COALESCE(project1_id, gen_random_uuid()), 'Ship Platform', NOW() - INTERVAL '5 days'),
        (dev_user_id, 'created', 'issue', COALESCE(issue1_id, gen_random_uuid()), 'Set up authentication', NOW() - INTERVAL '4 days'),
        (dev_user_id, 'status_changed', 'issue', COALESCE(issue1_id, gen_random_uuid()), 'Set up authentication', NOW() - INTERVAL '3 days'),
        (dev_user_id, 'created', 'issue', COALESCE(issue2_id, gen_random_uuid()), 'Build kanban board', NOW() - INTERVAL '3 days'),
        (dev_user_id, 'assigned', 'issue', COALESCE(issue2_id, gen_random_uuid()), 'Build kanban board', NOW() - INTERVAL '3 days'),
        (dev_user_id, 'created', 'issue', COALESCE(issue3_id, gen_random_uuid()), 'Add dark mode', NOW() - INTERVAL '2 days'),
        (dev_user_id, 'commented', 'issue', COALESCE(issue2_id, gen_random_uuid()), 'Build kanban board', NOW() - INTERVAL '1 day'),
        (dev_user_id, 'status_changed', 'issue', COALESCE(issue2_id, gen_random_uuid()), 'Build kanban board', NOW() - INTERVAL '12 hours'),
        (dev_user_id, 'created', 'document', gen_random_uuid(), 'API Documentation', NOW() - INTERVAL '6 hours'),
        (dev_user_id, 'created', 'standup', gen_random_uuid(), 'Daily standup', NOW() - INTERVAL '2 hours');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Activity log seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- NOTIFICATIONS — populate notifications page + bell
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = dev_user_id LIMIT 1) THEN
      INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, created_at) VALUES
        (dev_user_id, 'assignment', 'You were assigned an issue', 'Build kanban board has been assigned to you', 'issue', COALESCE(issue2_id, gen_random_uuid()), NOW() - INTERVAL '3 days'),
        (dev_user_id, 'status_change', 'Issue completed', 'Set up authentication was marked as done', 'issue', COALESCE(issue1_id, gen_random_uuid()), NOW() - INTERVAL '2 days'),
        (dev_user_id, 'comment', 'New comment on your issue', 'Great progress on the kanban board! The drag-and-drop feels smooth.', 'issue', COALESCE(issue2_id, gen_random_uuid()), NOW() - INTERVAL '1 day'),
        (dev_user_id, 'review_request', 'Review requested', 'Dev User submitted a weekly plan for review', 'weekly_plan', gen_random_uuid(), NOW() - INTERVAL '12 hours'),
        (dev_user_id, 'mention', 'You were mentioned', 'Dev User mentioned you in a comment on Ship Platform', 'project', COALESCE(project1_id, gen_random_uuid()), NOW() - INTERVAL '6 hours');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notifications seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- USER SETTINGS — populate settings page
  -- ============================================================
  BEGIN
    INSERT INTO user_settings (user_id, theme, notifications_enabled, email_digest, default_view, timezone)
    VALUES (dev_user_id, 'light', true, 'daily', 'list', 'America/New_York')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'User settings seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- SPRINT REVIEWS — populate sprint reviews page
  -- ============================================================
  BEGIN
    IF week1_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sprint_reviews WHERE week_id = week1_id AND author_id = dev_user_id) THEN
      INSERT INTO sprint_reviews (week_id, author_id, summary, accomplishments, challenges, next_steps, team_rating, status, submitted_at)
      VALUES (week1_id, dev_user_id,
        'Productive first week — shipped core features ahead of schedule',
        'Auth system, kanban board, 14 API routes, Railway deploy, full test suite',
        'Cross-boundary consistency between frontend and backend when using multi-agent mode',
        'Add contract extraction to agent prompts. Build live evals. Improve gather_context exemplar selection.',
        4, 'submitted', NOW() - INTERVAL '3 days');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Sprint reviews seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- ITERATIONS — populate iterations page
  -- ============================================================
  BEGIN
    IF team1_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM iterations WHERE name = 'Sprint 1') THEN
      INSERT INTO iterations (name, team_id, start_date, end_date, goal, status) VALUES
        ('Sprint 1', team1_id,
         (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT)::DATE,
         (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT + 13)::DATE,
         'Ship core features: auth, issues, kanban, weekly planning, FleetGraph integration',
         'active');
    END IF;
    IF team1_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM iterations WHERE name = 'Sprint 0 - Setup') THEN
      INSERT INTO iterations (name, team_id, start_date, end_date, goal, status) VALUES
        ('Sprint 0 - Setup', team1_id,
         (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT - 14)::DATE,
         (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT - 1)::DATE,
         'Project scaffolding, database setup, initial deployment',
         'completed');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Iterations seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- COMMENTS — populate comments on issues
  -- ============================================================
  BEGIN
    IF issue2_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM comments WHERE entity_id = issue2_id LIMIT 1) THEN
      INSERT INTO comments (entity_type, entity_id, author_id, content) VALUES
        ('issue', issue2_id, dev_user_id, 'Started working on the drag-and-drop implementation using @dnd-kit.'),
        ('issue', issue2_id, dev_user_id, 'Kanban board is looking great! Added all 7 status columns.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Comments seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- PROGRAMS — populate programs page
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM programs WHERE title = 'Q1 Delivery' LIMIT 1) THEN
      INSERT INTO programs (title, description)
      VALUES ('Q1 Delivery', 'All deliverables for Q1 2026 including Ship platform launch and FleetGraph integration');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Programs seed skipped: %', SQLERRM;
  END;

END $$;
