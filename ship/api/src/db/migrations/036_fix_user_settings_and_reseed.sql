-- Fix user_settings: add missing setup_completed column, add UNIQUE on user_id, fix id default
-- Also re-seed sprint reviews (seed 035 failed due to UNIQUE constraint on week_id+author_id
-- when records from seed 034 partially existed)

-- Fix user_settings table
ALTER TABLE user_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Add unique constraint if missing (needed for ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_user_id_key') THEN
    ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'user_settings constraint skipped: %', SQLERRM;
END $$;

-- Re-seed sprint reviews (using SQL directly, not API)
DO $$
DECLARE
  dev_user_id UUID;
  week1_id UUID;
  week2_id UUID;
BEGIN
  SELECT id INTO dev_user_id FROM users WHERE email = 'dev@ship.local';
  SELECT id INTO week1_id FROM weeks WHERE title = 'Week 1' LIMIT 1;
  SELECT id INTO week2_id FROM weeks WHERE title = 'Week 2' LIMIT 1;

  IF dev_user_id IS NOT NULL AND week1_id IS NOT NULL THEN
    INSERT INTO sprint_reviews (week_id, author_id, summary, accomplishments, challenges, next_steps, team_rating, status, submitted_at)
    VALUES (week1_id, dev_user_id,
      'Productive first week — shipped core features',
      'Auth system, kanban board, 14 API routes, Railway deploy',
      'Cross-boundary consistency in multi-agent mode',
      'Add contract extraction, build live evals',
      4, 'submitted', NOW() - INTERVAL '3 days')
    ON CONFLICT (week_id, author_id) DO NOTHING;
  END IF;

  IF dev_user_id IS NOT NULL AND week2_id IS NOT NULL THEN
    INSERT INTO sprint_reviews (week_id, author_id, summary, accomplishments, challenges, next_steps, team_rating, status)
    VALUES (week2_id, dev_user_id,
      'FleetGraph integration sprint',
      '13 features, FleetGraph chat panel, rate limiting, audit logging',
      'Worker path bugs, missing migrations, auth inconsistency',
      'Runtime verification, test enforcement',
      3, 'draft')
    ON CONFLICT (week_id, author_id) DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Sprint review seed skipped: %', SQLERRM;
END $$;
