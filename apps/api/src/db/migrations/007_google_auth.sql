-- Migration 007: Google/Firebase sign-in support.
-- Adds firebase_uid + avatar_url + name to users, and makes password_hash
-- optional (Google-only users have no password).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE INDEX IF NOT EXISTS ix_users_firebase_uid ON users(firebase_uid);
