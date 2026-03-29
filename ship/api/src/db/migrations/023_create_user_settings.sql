-- Migration to create user_settings table

CREATE TABLE user_settings (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    theme VARCHAR(10) NOT NULL CHECK (theme IN ('light', 'dark', 'system')),
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_digest VARCHAR(10) NOT NULL CHECK (email_digest IN ('none', 'daily', 'weekly')),
    default_view VARCHAR(10) NOT NULL CHECK (default_view IN ('list', 'kanban', 'calendar')),
    timezone VARCHAR(50) NOT NULL CHECK (timezone IN ('UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_user_settings_theme ON user_settings(theme);
CREATE INDEX idx_user_settings_email_digest ON user_settings(email_digest);
CREATE INDEX idx_user_settings_default_view ON user_settings(default_view);
CREATE INDEX idx_user_settings_timezone ON user_settings(timezone);
