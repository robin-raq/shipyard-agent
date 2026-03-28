-- Seed demo data for standups, weekly plans, retros, and feedback
-- Uses the existing dev user (dev@ship.local)

-- Get the dev user's ID for foreign key references
DO $$
DECLARE
  dev_user_id UUID;
  week1_id UUID;
  week2_id UUID;
  plan1_id UUID;
  plan2_id UUID;
BEGIN
  SELECT id INTO dev_user_id FROM users WHERE email = 'dev@ship.local';
  IF dev_user_id IS NULL THEN
    RAISE NOTICE 'Dev user not found, skipping seed data';
    RETURN;
  END IF;

  -- Get or create weeks
  SELECT id INTO week1_id FROM weeks WHERE title = 'Week 1' LIMIT 1;
  IF week1_id IS NULL THEN
    INSERT INTO weeks (title, content) VALUES ('Week 1', 'Sprint 1 - March 24-28') RETURNING id INTO week1_id;
  END IF;

  SELECT id INTO week2_id FROM weeks WHERE title = 'Week 2' LIMIT 1;
  IF week2_id IS NULL THEN
    INSERT INTO weeks (title, content) VALUES ('Week 2', 'Sprint 2 - March 31 - April 4') RETURNING id INTO week2_id;
  END IF;

  -- Seed standups (last 3 days)
  INSERT INTO standups (user_id, standup_date, yesterday, today, blockers)
  VALUES
    (dev_user_id, CURRENT_DATE - 2, 'Set up project scaffolding and database migrations', 'Build authentication system and session management', 'None'),
    (dev_user_id, CURRENT_DATE - 1, 'Completed auth system with login/register/logout', 'Build kanban board and issue tracking', 'Waiting on design review for the board layout'),
    (dev_user_id, CURRENT_DATE, 'Shipped kanban board with drag-and-drop', 'Add weekly plans and retros features', 'None')
  ON CONFLICT (user_id, standup_date) DO NOTHING;

  -- Seed weekly plans
  INSERT INTO weekly_plans (user_id, week_id, plan_content, status, submitted_at)
  VALUES
    (dev_user_id, week1_id, '<h2>Goals for Week 1</h2><ul><li>Ship authentication system</li><li>Build issue tracker with kanban board</li><li>Deploy to Railway</li></ul>', 'approved', NOW() - INTERVAL '5 days')
  ON CONFLICT (user_id, week_id) DO NOTHING;

  SELECT id INTO plan1_id FROM weekly_plans WHERE user_id = dev_user_id AND week_id = week1_id LIMIT 1;

  INSERT INTO weekly_plans (user_id, week_id, plan_content, status)
  VALUES
    (dev_user_id, week2_id, '<h2>Goals for Week 2</h2><ul><li>Add standups and daily workflow</li><li>Build weekly plans and retros</li><li>Implement manager review workflow</li><li>Add command palette and feedback portal</li></ul>', 'draft')
  ON CONFLICT (user_id, week_id) DO NOTHING;

  -- Seed weekly retros
  IF plan1_id IS NOT NULL THEN
    INSERT INTO weekly_retros (user_id, week_id, plan_id, went_well, to_improve, action_items, status, submitted_at)
    VALUES
      (dev_user_id, week1_id, plan1_id, 'Shipped auth, kanban, and 14 API routes in 2 days. Agent-built features saved significant time on boilerplate.', 'Cross-boundary consistency between frontend and backend. Agent used wrong field names 4 times.', 'Add contract extraction to agent prompts. Build live evals to catch pattern mismatches before deploy.', 'approved', NOW() - INTERVAL '3 days')
    ON CONFLICT (user_id, week_id) DO NOTHING;
  END IF;

  -- Seed feedback
  INSERT INTO feedback (name, email, title, message, status)
  VALUES
    ('Alex Chen', 'alex@example.com', 'Love the kanban board!', 'The drag-and-drop is smooth and the status columns make it easy to track work. Would love to see swimlanes by assignee.', 'reviewed'),
    ('Anonymous', NULL, 'Missing dark mode', 'Would be great to have a dark mode option for late night work sessions.', 'pending'),
    ('Jordan Smith', 'jordan@example.com', 'Standup form is great', 'The yesterday/today/blockers format keeps things focused. Suggestion: add a way to @mention teammates in blockers.', 'pending')
  ON CONFLICT DO NOTHING;

  -- Seed a review for the approved plan
  IF plan1_id IS NOT NULL THEN
    INSERT INTO reviews (reviewer_id, entity_type, entity_id, decision, comment)
    VALUES
      (dev_user_id, 'weekly_plan', plan1_id, 'approved', 'Great plan — clear deliverables and realistic scope.')
    ON CONFLICT DO NOTHING;
  END IF;

END $$;
