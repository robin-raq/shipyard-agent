-- Migration: 010_migrate_existing_data_to_unified_documents_table.sql
-- This migration creates a unified documents table and migrates existing data from separate tables

-- Create unified documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('doc', 'issue', 'project', 'week', 'team', 'ship')),
    title VARCHAR(500) NOT NULL,
    content TEXT DEFAULT '',
    properties JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Migrate data from docs table
INSERT INTO documents (id, document_type, title, content, properties, status, created_at, updated_at, deleted_at)
SELECT 
    id, 
    'doc' AS document_type, 
    title, 
    COALESCE(content, '') AS content,
    '{}'::jsonb AS properties,
    NULL AS status,
    created_at, 
    updated_at,
    deleted_at
FROM docs
ON CONFLICT (id) DO NOTHING;

-- Migrate data from issues table
INSERT INTO documents (id, document_type, title, content, properties, status, created_at, updated_at, deleted_at)
SELECT 
    id, 
    'issue' AS document_type, 
    title, 
    COALESCE(content, '') AS content,
    jsonb_build_object(
        'priority', priority,
        'project_id', project_id
    ) AS properties,
    status,
    created_at, 
    updated_at,
    deleted_at
FROM issues
ON CONFLICT (id) DO NOTHING;

-- Migrate data from projects table
INSERT INTO documents (id, document_type, title, content, properties, status, created_at, updated_at, deleted_at)
SELECT 
    id, 
    'project' AS document_type, 
    title, 
    COALESCE(description, '') AS content,
    '{}'::jsonb AS properties,
    status,
    created_at, 
    updated_at,
    deleted_at
FROM projects
ON CONFLICT (id) DO NOTHING;

-- Migrate data from weeks table
INSERT INTO documents (id, document_type, title, content, properties, status, created_at, updated_at, deleted_at)
SELECT 
    id, 
    'week' AS document_type, 
    title, 
    COALESCE(content, '') AS content,
    jsonb_build_object(
        'start_date', start_date,
        'end_date', end_date
    ) AS properties,
    NULL AS status,
    created_at, 
    updated_at,
    deleted_at
FROM weeks
ON CONFLICT (id) DO NOTHING;

-- Migrate data from teams table
INSERT INTO documents (id, document_type, title, content, properties, status, created_at, updated_at, deleted_at)
SELECT 
    id, 
    'team' AS document_type, 
    name AS title, 
    COALESCE(description, '') AS content,
    '{}'::jsonb AS properties,
    NULL AS status,
    created_at, 
    updated_at,
    deleted_at
FROM teams
ON CONFLICT (id) DO NOTHING;

-- Migrate data from ships table
-- Note: ships table uses SERIAL id (integer), while documents uses UUID
-- We store the original ship ID in properties for reference
-- Only insert if not already migrated (check by looking for ship documents with matching original_ship_id)
INSERT INTO documents (id, document_type, title, content, properties, status, created_at, updated_at, deleted_at)
SELECT 
    gen_random_uuid() AS id,
    'ship' AS document_type, 
    name AS title, 
    COALESCE(description, '') AS content,
    jsonb_build_object(
        'original_ship_id', id
    ) AS properties,
    status,
    created_at, 
    updated_at,
    deleted_at
FROM ships
WHERE NOT EXISTS (
    SELECT 1 FROM documents 
    WHERE document_type = 'ship' 
    AND properties->>'original_ship_id' = ships.id::text
);
