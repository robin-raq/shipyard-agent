-- Migration to create attachments table

CREATE TABLE attachments (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('issue', 'project', 'document')),
    entity_id UUID NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);
