-- Migration to add org chart fields to users table

ALTER TABLE users
ADD COLUMN title VARCHAR(255),
ADD COLUMN department VARCHAR(255),
ADD COLUMN reports_to UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_users_reports_to ON users(reports_to);