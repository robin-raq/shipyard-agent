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
