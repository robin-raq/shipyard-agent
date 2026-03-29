-- Migration to create sprint_reviews table

CREATE TABLE sprint_reviews (
    id UUID PRIMARY KEY,
    week_id UUID NOT NULL,
    author_id UUID NOT NULL,
    summary TEXT NOT NULL,
    accomplishments TEXT NOT NULL,
    challenges TEXT NOT NULL,
    next_steps TEXT NOT NULL,
    team_rating INTEGER NOT NULL CHECK (team_rating >= 0 AND team_rating <= 10),
    status VARCHAR(50) NOT NULL CHECK (status IN ('draft', 'submitted', 'finalized')),
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_sprint_reviews_week ON sprint_reviews(week_id);
CREATE INDEX idx_sprint_reviews_author ON sprint_reviews(author_id);
CREATE INDEX idx_sprint_reviews_status ON sprint_reviews(status);
