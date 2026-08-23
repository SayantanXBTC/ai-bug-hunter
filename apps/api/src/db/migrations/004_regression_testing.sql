-- AI Bug Hunter — Phase 9: flaky detection + regression campaigns

ALTER TABLE test_cases
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('critical','high','medium','low')),
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('generated','manual','imported')),
  ADD COLUMN IF NOT EXISTS external_test_id TEXT;

CREATE INDEX IF NOT EXISTS ix_test_cases_priority ON test_cases(priority);
CREATE INDEX IF NOT EXISTS ix_test_cases_enabled ON test_cases(enabled);
CREATE INDEX IF NOT EXISTS ix_test_cases_external_test_id ON test_cases(external_test_id);

CREATE TABLE IF NOT EXISTS test_reliability_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
  external_test_id TEXT NOT NULL UNIQUE,
  total_runs INT NOT NULL,
  pass_count INT NOT NULL,
  failure_count INT NOT NULL,
  error_count INT NOT NULL,
  flaky_score NUMERIC(3,2) NOT NULL CHECK (flaky_score >= 0 AND flaky_score <= 1),
  reliability_score NUMERIC(3,2) NOT NULL CHECK (reliability_score >= 0 AND reliability_score <= 1),
  status TEXT NOT NULL CHECK (
    status IN ('stable','suspected_flaky','flaky','unstable','insufficient_data')
  ),
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  environment_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_reliability_status ON test_reliability_snapshots(status);
CREATE INDEX IF NOT EXISTS ix_reliability_calculated_at ON test_reliability_snapshots(calculated_at DESC);

CREATE TABLE IF NOT EXISTS regression_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','passed','failed','cancelled','error')),
  trigger TEXT NOT NULL CHECK (trigger IN ('manual','api','ci')),
  selection_strategy TEXT NOT NULL CHECK (
    selection_strategy IN ('all_enabled','risk_based','changed_area','bug_targeted','smoke')
  ),
  requested_test_count INT NOT NULL DEFAULT 0,
  selected_test_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  total_runs INT NOT NULL DEFAULT 0,
  passed_runs INT NOT NULL DEFAULT 0,
  failed_runs INT NOT NULL DEFAULT 0,
  error_runs INT NOT NULL DEFAULT 0,
  quality TEXT CHECK (quality IN ('healthy','degraded','failed','inconclusive')),
  cancel_requested BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_regression_campaigns_status ON regression_campaigns(status);
CREATE INDEX IF NOT EXISTS ix_regression_campaigns_created_at ON regression_campaigns(created_at DESC);

CREATE TABLE IF NOT EXISTS regression_campaign_tests (
  campaign_id UUID NOT NULL REFERENCES regression_campaigns(id) ON DELETE CASCADE,
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  selection_score NUMERIC(4,3) NOT NULL,
  selection_reason JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_run_id UUID REFERENCES test_runs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','passed','failed','error','skipped')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  ordinal INT NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, test_case_id)
);
CREATE INDEX IF NOT EXISTS ix_campaign_tests_status ON regression_campaign_tests(status);
