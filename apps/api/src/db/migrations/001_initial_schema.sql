-- Initial AI Bug Hunter schema.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_applications_created_at ON applications(created_at DESC);

CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_url TEXT NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_test_cases_application_id ON test_cases(application_id);

CREATE TABLE IF NOT EXISTS test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
  external_test_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed','failed','error')),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL,
  error_name TEXT,
  error_message TEXT,
  error_step_index INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_test_runs_test_case_id ON test_runs(test_case_id);
CREATE INDEX IF NOT EXISTS ix_test_runs_created_at ON test_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_test_runs_status ON test_runs(status);

CREATE TABLE IF NOT EXISTS test_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed','failed','skipped')),
  duration_ms INTEGER NOT NULL,
  error_name TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (test_run_id, step_index)
);
CREATE INDEX IF NOT EXISTS ix_test_run_steps_test_run_id ON test_run_steps(test_run_id);

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_artifacts_sha256 ON artifacts(sha256);

CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_run_step_id UUID REFERENCES test_run_steps(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL CHECK (
    evidence_type IN ('screenshot','dom','console','page_error','network','browser_metadata')
  ),
  artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_evidence_test_run_id ON evidence(test_run_id);
CREATE INDEX IF NOT EXISTS ix_evidence_type ON evidence(evidence_type);
