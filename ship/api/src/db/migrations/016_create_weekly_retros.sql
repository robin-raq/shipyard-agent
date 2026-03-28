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
