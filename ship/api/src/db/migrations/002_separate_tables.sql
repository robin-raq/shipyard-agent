-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','archived'))
);

-- Create docs table
CREATE TABLE IF NOT EXISTS docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT DEFAULT ''
);

-- Create issues table
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','in_progress','done','closed')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL
);

-- Create weeks table
CREATE TABLE IF NOT EXISTS weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT DEFAULT '',
  start_date DATE,
  end_date DATE
);

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT ''
);

-- Migrate existing data from documents table
INSERT INTO projects (id, created_at, updated_at, deleted_at, title, description)
SELECT id, created_at, updated_at, deleted_at, title, content
FROM documents
WHERE document_type = 'project';

INSERT INTO docs (id, created_at, updated_at, deleted_at, title, content)
SELECT id, created_at, updated_at, deleted_at, title, content
FROM documents
WHERE document_type = 'doc';

INSERT INTO issues (id, created_at, updated_at, deleted_at, title, content)
SELECT id, created_at, updated_at, deleted_at, title, content
FROM documents
WHERE document_type = 'issue';

INSERT INTO weeks (id, created_at, updated_at, deleted_at, title, content)
SELECT id, created_at, updated_at, deleted_at, title, content
FROM documents
WHERE document_type = 'week';

INSERT INTO teams (id, created_at, updated_at, deleted_at, name, description)
SELECT id, created_at, updated_at, deleted_at, title, content
FROM documents
WHERE document_type = 'team';

-- Drop the documents table
DROP TABLE IF EXISTS documents;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_docs_deleted_at ON docs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_issues_deleted_at ON issues(deleted_at);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_weeks_deleted_at ON weeks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_teams_deleted_at ON teams(deleted_at);
