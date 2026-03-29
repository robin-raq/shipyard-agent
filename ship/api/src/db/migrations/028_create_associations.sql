-- Migration to create associations table

CREATE TABLE associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(20) NOT NULL,
    source_id UUID NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id UUID NOT NULL,
    relationship VARCHAR(20) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_associations_source ON associations(source_type, source_id);
CREATE INDEX idx_associations_target ON associations(target_type, target_id);
CREATE INDEX idx_associations_relationship ON associations(relationship);
