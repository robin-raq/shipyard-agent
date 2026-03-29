-- Migration to create iterations table

CREATE TABLE iterations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    team_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    goal TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('planned', 'active', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_iterations_team_id ON iterations(team_id);
CREATE INDEX idx_iterations_status ON iterations(status);
CREATE INDEX idx_iterations_start_date ON iterations(start_date);
CREATE INDEX idx_iterations_end_date ON iterations(end_date);
