-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('issue', 'doc', 'project', 'week', 'team')),
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  author_name VARCHAR(255) DEFAULT 'Anonymous'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_deleted_at ON comments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
