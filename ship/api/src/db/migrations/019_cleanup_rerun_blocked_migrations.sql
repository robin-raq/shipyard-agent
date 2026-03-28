-- Cleanup: remove stale migration entries that may have been recorded
-- during failed deploys, so the corrected versions can re-run.
DELETE FROM _migrations WHERE name IN (
  '013_expand_issue_statuses_for_kanban.sql',
  '014_create_standups_table.sql',
  '015_create_weekly_plans.sql',
  '016_create_weekly_retros.sql',
  '017_create_reviews.sql',
  '018_create_feedback.sql'
);

-- Re-run migration 013: expand issue statuses for kanban
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check CHECK (status IN ('triage', 'backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'));
UPDATE issues SET status = 'triage' WHERE status = 'open';
UPDATE issues SET status = 'cancelled' WHERE status = 'closed';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee_id);

-- Re-run migration 014: create standups table
CREATE TABLE IF NOT EXISTS standups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  standup_date DATE NOT NULL DEFAULT CURRENT_DATE,
  yesterday TEXT NOT NULL DEFAULT '',
  today TEXT NOT NULL DEFAULT '',
  blockers TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(user_id, standup_date)
);
CREATE INDEX IF NOT EXISTS idx_standups_user_date ON standups(user_id, standup_date);
CREATE INDEX IF NOT EXISTS idx_standups_date ON standups(standup_date);
CREATE INDEX IF NOT EXISTS idx_standups_deleted_at ON standups(deleted_at);

-- Re-run migration 015: create weekly_plans table
CREATE TABLE IF NOT EXISTS weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_id UUID REFERENCES weeks(id) ON DELETE SET NULL,
  plan_content TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'changes_requested')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(user_id, week_id)
);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_user ON weekly_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_week ON weekly_plans(week_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_status ON weekly_plans(status);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_deleted ON weekly_plans(deleted_at);

-- Re-run migration 016: create weekly_retros table
CREATE TABLE IF NOT EXISTS weekly_retros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_id UUID REFERENCES weeks(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES weekly_plans(id) ON DELETE SET NULL,
  went_well TEXT NOT NULL DEFAULT '',
  to_improve TEXT NOT NULL DEFAULT '',
  action_items TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'changes_requested')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(user_id, week_id)
);
CREATE INDEX IF NOT EXISTS idx_weekly_retros_user ON weekly_retros(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_retros_week ON weekly_retros(week_id);
CREATE INDEX IF NOT EXISTS idx_weekly_retros_plan ON weekly_retros(plan_id);
CREATE INDEX IF NOT EXISTS idx_weekly_retros_status ON weekly_retros(status);
CREATE INDEX IF NOT EXISTS idx_weekly_retros_deleted ON weekly_retros(deleted_at);

-- Re-run migration 017: create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('weekly_plan', 'weekly_retro')),
  entity_id UUID NOT NULL,
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_entity ON reviews(entity_type, entity_id);

-- Re-run migration 018: create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) DEFAULT 'Anonymous',
  email VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
