-- Migration to create backlinks table

CREATE TABLE backlinks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL,
    source_id UUID NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backlinks_source_type ON backlinks(source_type);
CREATE INDEX idx_backlinks_target_type ON backlinks(target_type);
CREATE INDEX idx_backlinks_created_at ON backlinks(created_at);
