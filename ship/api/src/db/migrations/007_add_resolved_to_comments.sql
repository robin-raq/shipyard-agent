-- Add resolved field to comments table
ALTER TABLE comments ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE;

-- Create index for resolved field
CREATE INDEX IF NOT EXISTS idx_comments_resolved ON comments(resolved);
