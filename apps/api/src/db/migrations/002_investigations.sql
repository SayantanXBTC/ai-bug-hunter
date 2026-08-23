-- AI Bug Hunter — Phase 7: investigation persistence
CREATE TABLE IF NOT EXISTS investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL UNIQUE REFERENCES test_runs(id) ON DELETE CASCADE,
  classification TEXT NOT NULL CHECK (
    classification IN (
      'application_defect',
      'test_defect',
      'environment_failure',
      'dependency_failure',
      'data_failure',
      'inconclusive'
    )
  ),
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','none')),
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  summary TEXT NOT NULL,
  likely_root_cause TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  report_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_investigations_test_run_id ON investigations(test_run_id);
CREATE INDEX IF NOT EXISTS ix_investigations_classification ON investigations(classification);
