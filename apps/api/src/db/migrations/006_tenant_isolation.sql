-- Migration 006: tenant isolation.
-- Adds owner_id to primary business tables. Idempotent and additive.
-- Semantics:
--   * owner_id NULL means the row is legacy / unowned. Only admins can see it.
--   * Non-admin users see only their own rows (WHERE owner_id = $userId).
--   * Admins see everything (WHERE owner_id = $userId OR $isAdmin).
-- No backfill is performed. Existing data remains admin-only visible.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS applications_owner_idx ON applications(owner_id);

ALTER TABLE test_cases
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS test_cases_owner_idx ON test_cases(owner_id);

ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS test_runs_owner_idx ON test_runs(owner_id);

ALTER TABLE bug_clusters
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bug_clusters_owner_idx ON bug_clusters(owner_id);

ALTER TABLE regression_campaigns
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS regression_campaigns_owner_idx ON regression_campaigns(owner_id);
