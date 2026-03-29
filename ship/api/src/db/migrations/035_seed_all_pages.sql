-- Seed data for ALL pages — uses correct column names per table schema
-- Each section is independent with exception handling

DO $$
DECLARE
  dev_user_id UUID;
  week1_id UUID;
  week2_id UUID;
  team1_id UUID;
  team2_id UUID;
  project1_id UUID;
  user2_id UUID;
  user3_id UUID;
  user4_id UUID;
  user5_id UUID;
BEGIN
  SELECT id INTO dev_user_id FROM users WHERE email = 'dev@ship.local';
  IF dev_user_id IS NULL THEN
    RAISE NOTICE 'Dev user not found';
    RETURN;
  END IF;

  -- ============================================================
  -- ADDITIONAL USERS (for org chart — need 10+ people)
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'alice@ship.local') THEN
      INSERT INTO users (username, email, password, role, title, department, reports_to)
      VALUES ('alice', 'alice@ship.local', '$2b$10$placeholder_hash_not_real_login', 'member', 'Frontend Lead', 'Engineering', dev_user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'bob@ship.local') THEN
      INSERT INTO users (username, email, password, role, title, department, reports_to)
      VALUES ('bob', 'bob@ship.local', '$2b$10$placeholder_hash_not_real_login', 'member', 'Backend Engineer', 'Engineering', dev_user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'carol@ship.local') THEN
      INSERT INTO users (username, email, password, role, title, department, reports_to)
      VALUES ('carol', 'carol@ship.local', '$2b$10$placeholder_hash_not_real_login', 'member', 'Designer', 'Design', dev_user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'david@ship.local') THEN
      INSERT INTO users (username, email, password, role, title, department, reports_to)
      VALUES ('david', 'david@ship.local', '$2b$10$placeholder_hash_not_real_login', 'member', 'QA Engineer', 'Engineering', NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'emma@ship.local') THEN
      INSERT INTO users (username, email, password, role, title, department)
      VALUES ('emma', 'emma@ship.local', '$2b$10$placeholder_hash_not_real_login', 'member', 'Product Manager', 'Product');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'frank@ship.local') THEN
      INSERT INTO users (username, email, password, role, title, department)
      VALUES ('frank', 'frank@ship.local', '$2b$10$placeholder_hash_not_real_login', 'member', 'DevOps Engineer', 'Infrastructure');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'grace@ship.local') THEN
      INSERT INTO users (username, email, password, role, title, department)
      VALUES ('grace', 'grace@ship.local', '$2b$10$placeholder_hash_not_real_login', 'member', 'Data Analyst', 'Analytics');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'henry@ship.local') THEN
      INSERT INTO users (username, email, password, role, title, department)
      VALUES ('henry', 'henry@ship.local', '$2b$10$placeholder_hash_not_real_login', 'member', 'Mobile Developer', 'Engineering');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'iris@ship.local') THEN
      INSERT INTO users (username, email, password, role, title, department)
      VALUES ('iris', 'iris@ship.local', '$2b$10$placeholder_hash_not_real_login', 'member', 'Technical Writer', 'Documentation');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'jack@ship.local') THEN
      INSERT INTO users (username, email, password, role, title, department)
      VALUES ('jack', 'jack@ship.local', '$2b$10$placeholder_hash_not_real_login', 'admin', 'VP Engineering', 'Engineering');
    END IF;

    -- Set up reporting chain
    SELECT id INTO user2_id FROM users WHERE email = 'alice@ship.local';
    SELECT id INTO user3_id FROM users WHERE email = 'bob@ship.local';
    SELECT id INTO user4_id FROM users WHERE email = 'emma@ship.local';
    SELECT id INTO user5_id FROM users WHERE email = 'jack@ship.local';

    -- alice and bob report to dev, dev reports to jack
    UPDATE users SET reports_to = dev_user_id WHERE email IN ('alice@ship.local', 'bob@ship.local', 'carol@ship.local');
    UPDATE users SET reports_to = user5_id WHERE email = 'dev@ship.local';
    UPDATE users SET reports_to = user2_id WHERE email = 'henry@ship.local';
    UPDATE users SET reports_to = user4_id WHERE email IN ('iris@ship.local', 'grace@ship.local');
    UPDATE users SET reports_to = user5_id WHERE email IN ('david@ship.local', 'frank@ship.local');

    -- Set dev user profile
    UPDATE users SET title = 'Senior Engineer', department = 'Engineering',
      display_name = 'Dev User', bio = 'Full-stack developer building Ship.', location = 'San Francisco, CA'
    WHERE id = dev_user_id AND (display_name IS NULL OR display_name = '');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Users seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- TEAMS (column: name, not title)
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM teams WHERE name = 'Engineering' AND deleted_at IS NULL) THEN
      INSERT INTO teams (name, description) VALUES ('Engineering', 'Core engineering team building Ship')
      RETURNING id INTO team1_id;
    ELSE
      SELECT id INTO team1_id FROM teams WHERE name = 'Engineering' AND deleted_at IS NULL LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM teams WHERE name = 'Product' AND deleted_at IS NULL) THEN
      INSERT INTO teams (name, description) VALUES ('Product', 'Product management and design')
      RETURNING id INTO team2_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM teams WHERE name = 'Infrastructure' AND deleted_at IS NULL) THEN
      INSERT INTO teams (name, description) VALUES ('Infrastructure', 'DevOps and platform reliability');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Teams seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- PROJECTS (column: title + description, has status)
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM projects WHERE title = 'Ship Platform' AND deleted_at IS NULL) THEN
      INSERT INTO projects (title, description, status)
      VALUES ('Ship Platform', 'Main project management application', 'active')
      RETURNING id INTO project1_id;
    ELSE
      SELECT id INTO project1_id FROM projects WHERE title = 'Ship Platform' AND deleted_at IS NULL LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM projects WHERE title = 'FleetGraph Agent' AND deleted_at IS NULL) THEN
      INSERT INTO projects (title, description, status)
      VALUES ('FleetGraph Agent', 'Project intelligence agent with proactive monitoring', 'active');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM projects WHERE title = 'Mobile App' AND deleted_at IS NULL) THEN
      INSERT INTO projects (title, description, status)
      VALUES ('Mobile App', 'iOS and Android companion app for Ship', 'active');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Projects seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- SHIPS (column: name, id is SERIAL not UUID)
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM ships WHERE name = 'v1.0 Launch' AND deleted_at IS NULL) THEN
      INSERT INTO ships (name, description, status) VALUES ('v1.0 Launch', 'Initial release with core features', 'active');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM ships WHERE name = 'v1.1 FleetGraph' AND deleted_at IS NULL) THEN
      INSERT INTO ships (name, description, status) VALUES ('v1.1 FleetGraph', 'Project intelligence agent integration', 'active');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM ships WHERE name = 'v1.2 Mobile' AND deleted_at IS NULL) THEN
      INSERT INTO ships (name, description, status) VALUES ('v1.2 Mobile', 'Mobile companion app release', 'active');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Ships seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- PROGRAMS (column: name, id is SERIAL not UUID)
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM programs WHERE name = 'Q1 2026 Delivery') THEN
      INSERT INTO programs (name, description) VALUES ('Q1 2026 Delivery', 'All Q1 deliverables including Ship launch and FleetGraph');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM programs WHERE name = 'Platform Reliability') THEN
      INSERT INTO programs (name, description) VALUES ('Platform Reliability', 'Infrastructure, monitoring, and performance improvements');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Programs seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- WEEKS — ensure dates are set
  -- ============================================================
  BEGIN
    SELECT id INTO week1_id FROM weeks WHERE title = 'Week 1' LIMIT 1;
    SELECT id INTO week2_id FROM weeks WHERE title = 'Week 2' LIMIT 1;

    IF week1_id IS NOT NULL THEN
      UPDATE weeks SET
        start_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT - 7)::DATE,
        end_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT - 1)::DATE
      WHERE id = week1_id AND start_date IS NULL;
    END IF;

    IF week2_id IS NOT NULL THEN
      UPDATE weeks SET
        start_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT)::DATE,
        end_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT + 6)::DATE
      WHERE id = week2_id AND start_date IS NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Weeks seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- SPRINT REVIEWS
  -- ============================================================
  BEGIN
    IF week1_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sprint_reviews WHERE week_id = week1_id AND author_id = dev_user_id) THEN
      INSERT INTO sprint_reviews (week_id, author_id, summary, accomplishments, challenges, next_steps, team_rating, status, submitted_at)
      VALUES (week1_id, dev_user_id,
        'Shipped core features ahead of schedule',
        'Auth, kanban board, 14 API routes, Railway deploy',
        'Cross-boundary consistency in multi-agent mode',
        'Add contract extraction, build live evals',
        4, 'submitted', NOW() - INTERVAL '3 days');
    END IF;
    IF week2_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sprint_reviews WHERE week_id = week2_id AND author_id = dev_user_id) THEN
      INSERT INTO sprint_reviews (week_id, author_id, summary, accomplishments, challenges, next_steps, team_rating, status)
      VALUES (week2_id, dev_user_id,
        'FleetGraph integration and infrastructure sprint',
        'FleetGraph chat panel, rate limiting, audit logging, 13 new features',
        'Worker path resolution, missing migrations, auth pattern inconsistency',
        'Runtime verification, test enforcement, auth pattern linting',
        3, 'draft');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Sprint reviews seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- ITERATIONS (needs valid team_id UUID, but teams use UUID)
  -- ============================================================
  BEGIN
    SELECT id INTO team1_id FROM teams WHERE name = 'Engineering' AND deleted_at IS NULL LIMIT 1;
    IF team1_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM iterations WHERE name = 'Sprint 1') THEN
        INSERT INTO iterations (name, team_id, start_date, end_date, goal, status) VALUES
          ('Sprint 1', team1_id,
           (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT)::DATE,
           (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT + 13)::DATE,
           'Ship core features and FleetGraph integration', 'active');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM iterations WHERE name = 'Sprint 0') THEN
        INSERT INTO iterations (name, team_id, start_date, end_date, goal, status) VALUES
          ('Sprint 0', team1_id,
           (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT - 14)::DATE,
           (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT - 1)::DATE,
           'Project setup and scaffolding', 'completed');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Iterations seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- NOTIFICATIONS (needs explicit UUID for id)
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = dev_user_id LIMIT 1) THEN
      INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, created_at) VALUES
        (gen_random_uuid(), dev_user_id, 'assignment', 'You were assigned: Build kanban board', 'High priority issue assigned to you', 'issue', gen_random_uuid(), NOW() - INTERVAL '3 days'),
        (gen_random_uuid(), dev_user_id, 'status_change', 'Issue completed: Set up authentication', 'Marked as done by dev', 'issue', gen_random_uuid(), NOW() - INTERVAL '2 days'),
        (gen_random_uuid(), dev_user_id, 'comment', 'New comment on Build kanban board', 'Great progress! The drag-and-drop feels smooth.', 'issue', gen_random_uuid(), NOW() - INTERVAL '1 day'),
        (gen_random_uuid(), dev_user_id, 'review_request', 'Review requested: Week 1 Plan', 'Dev User submitted a weekly plan for your review', 'weekly_plan', gen_random_uuid(), NOW() - INTERVAL '12 hours'),
        (gen_random_uuid(), dev_user_id, 'mention', 'You were mentioned in Ship Platform', 'Dev User mentioned you in a project discussion', 'project', gen_random_uuid(), NOW() - INTERVAL '6 hours'),
        (gen_random_uuid(), dev_user_id, 'review_decision', 'Plan approved', 'Your Week 1 plan was approved', 'weekly_plan', gen_random_uuid(), NOW() - INTERVAL '4 hours'),
        (gen_random_uuid(), dev_user_id, 'assignment', 'New task: API rate limiting', 'You were assigned a high priority issue', 'issue', gen_random_uuid(), NOW() - INTERVAL '2 hours');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notifications seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- ACTIVITY LOG
  -- ============================================================
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM activity_log WHERE user_id = dev_user_id LIMIT 1) THEN
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_title, created_at) VALUES
        (dev_user_id, 'created', 'project', gen_random_uuid(), 'Ship Platform', NOW() - INTERVAL '5 days'),
        (dev_user_id, 'created', 'issue', gen_random_uuid(), 'Set up authentication', NOW() - INTERVAL '4 days'),
        (dev_user_id, 'status_changed', 'issue', gen_random_uuid(), 'Set up authentication', NOW() - INTERVAL '3 days'),
        (dev_user_id, 'created', 'issue', gen_random_uuid(), 'Build kanban board', NOW() - INTERVAL '3 days'),
        (dev_user_id, 'assigned', 'issue', gen_random_uuid(), 'Build kanban board', NOW() - INTERVAL '3 days'),
        (dev_user_id, 'created', 'issue', gen_random_uuid(), 'Add dark mode', NOW() - INTERVAL '2 days'),
        (dev_user_id, 'commented', 'issue', gen_random_uuid(), 'Build kanban board', NOW() - INTERVAL '1 day'),
        (dev_user_id, 'status_changed', 'issue', gen_random_uuid(), 'Build kanban board', NOW() - INTERVAL '12 hours'),
        (dev_user_id, 'created', 'document', gen_random_uuid(), 'API Documentation', NOW() - INTERVAL '6 hours'),
        (dev_user_id, 'created', 'standup', gen_random_uuid(), 'Daily standup', NOW() - INTERVAL '2 hours');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Activity log seed skipped: %', SQLERRM;
  END;

  -- ============================================================
  -- USER SETTINGS
  -- ============================================================
  BEGIN
    INSERT INTO user_settings (user_id, theme, notifications_enabled, email_digest, default_view, timezone)
    VALUES (dev_user_id, 'light', true, 'daily', 'list', 'America/New_York')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Settings seed skipped: %', SQLERRM;
  END;

END $$;
