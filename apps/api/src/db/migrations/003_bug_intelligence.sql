-- AI Bug Hunter — Phase 8: bug intelligence / failure clusters

CREATE TABLE IF NOT EXISTS bug_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('open','recurring','regressed','resolved','inconclusive')),
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','none','unknown')),
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 0,
  affected_test_count INTEGER NOT NULL DEFAULT 0,
  affected_page_count INTEGER NOT NULL DEFAULT 0,
  affected_endpoint_count INTEGER NOT NULL DEFAULT 0,
  regression_status TEXT NOT NULL CHECK (
    regression_status IN ('first_seen','recurring','regressed','resolved','inconclusive')
  ),
  primary_run_id UUID REFERENCES test_runs(id) ON DELETE SET NULL,
  primary_investigation_id UUID,
  primary_failure_signature TEXT,
  root_cause_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_bug_clusters_status ON bug_clusters(status);
CREATE INDEX IF NOT EXISTS ix_bug_clusters_last_seen ON bug_clusters(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS ix_bug_clusters_regression_status ON bug_clusters(regression_status);

CREATE TABLE IF NOT EXISTS bug_cluster_members (
  cluster_id UUID NOT NULL REFERENCES bug_clusters(id) ON DELETE CASCADE,
  test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  similarity_score NUMERIC(4,3) NOT NULL,
  membership_reason JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cluster_id, test_run_id)
);
CREATE INDEX IF NOT EXISTS ix_bug_cluster_members_test_run ON bug_cluster_members(test_run_id);
