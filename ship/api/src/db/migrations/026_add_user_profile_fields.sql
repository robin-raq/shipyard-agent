-- Migration to add user profile fields to users table

ALTER TABLE users
ADD COLUMN display_name VARCHAR(255),
ADD COLUMN bio TEXT,
ADD COLUMN avatar_url VARCHAR(255),
ADD COLUMN phone VARCHAR(20),
ADD COLUMN location VARCHAR(255);
