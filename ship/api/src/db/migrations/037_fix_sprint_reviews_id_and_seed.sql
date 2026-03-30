-- Fix sprint_reviews.id missing DEFAULT, and seed reviews
ALTER TABLE sprint_reviews ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add unique constraint for ON CONFLICT support
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sprint_reviews_week_author_key') THEN
    ALTER TABLE sprint_reviews ADD CONSTRAINT sprint_reviews_week_author_key UNIQUE (week_id, author_id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Seed sprint reviews
DO $$
DECLARE uid UUID; w1 UUID; w2 UUID;
BEGIN
  SELECT id INTO uid FROM users WHERE email = 'dev@ship.local';
  SELECT id INTO w1 FROM weeks WHERE title = 'Week 1';
  SELECT id INTO w2 FROM weeks WHERE title = 'Week 2';

  IF uid IS NOT NULL AND w1 IS NOT NULL THEN
    INSERT INTO sprint_reviews (week_id, author_id, summary, accomplishments, challenges, next_steps, team_rating, status, submitted_at)
    VALUES (w1, uid, 'Week 1 — Shipped Core Features', 'Auth, kanban, 14 routes, Railway deploy', 'Multi-agent consistency', 'Contract extraction, live evals', 4, 'submitted', NOW()-INTERVAL '3 days')
    ON CONFLICT (week_id, author_id) DO NOTHING;
  END IF;

  IF uid IS NOT NULL AND w2 IS NOT NULL THEN
    INSERT INTO sprint_reviews (week_id, author_id, summary, accomplishments, challenges, next_steps, team_rating, status)
    VALUES (w2, uid, 'Week 2 — FleetGraph Integration', '13 features, FleetGraph, rate limiting', 'Path bugs, missing migrations', 'Runtime verification', 3, 'draft')
    ON CONFLICT (week_id, author_id) DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Sprint review seed skipped: %', SQLERRM;
END $$;
