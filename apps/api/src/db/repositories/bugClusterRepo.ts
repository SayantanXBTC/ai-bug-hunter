import type { Pool, PoolClient } from 'pg';
import type {
  BugCluster,
  BugClusterMember,
  ClusterStatus,
  RegressionStatus,
  SimilaritySignal,
} from '../../ai/intelligence/intelligenceTypes.js';

export interface BugClusterRow {
  id: string;
  fingerprint_key: string;
  title: string;
  description: string | null;
  status: ClusterStatus;
  severity: string;
  confidence: string;
  first_seen_at: Date;
  last_seen_at: Date;
  occurrence_count: number;
  affected_test_count: number;
  affected_page_count: number;
  affected_endpoint_count: number;
  regression_status: RegressionStatus;
  primary_run_id: string | null;
  primary_investigation_id: string | null;
  primary_failure_signature: string | null;
  root_cause_summary: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BugClusterMemberRow {
  cluster_id: string;
  test_run_id: string;
  similarity_score: string;
  membership_reason: SimilaritySignal[];
  created_at: Date;
}

type Executor = Pool | PoolClient;

export interface UpsertClusterInput {
  fingerprintKey: string;
  title: string;
  description: string | null;
  status: ClusterStatus;
  severity: string;
  confidence: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
  affectedTestCount: number;
  affectedPageCount: number;
  affectedEndpointCount: number;
  regressionStatus: RegressionStatus;
  primaryRunId: string | null;
  primaryInvestigationId: string | null;
  primaryFailureSignature: string | null;
  rootCauseSummary: string | null;
}

export async function upsertCluster(
  exec: Executor,
  input: UpsertClusterInput,
): Promise<BugClusterRow> {
  const { rows } = await exec.query<BugClusterRow>(
    `INSERT INTO bug_clusters
      (fingerprint_key, title, description, status, severity, confidence,
       first_seen_at, last_seen_at, occurrence_count, affected_test_count,
       affected_page_count, affected_endpoint_count, regression_status,
       primary_run_id, primary_investigation_id, primary_failure_signature,
       root_cause_summary, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
     ON CONFLICT (fingerprint_key) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       status = EXCLUDED.status,
       severity = EXCLUDED.severity,
       confidence = EXCLUDED.confidence,
       first_seen_at = LEAST(bug_clusters.first_seen_at, EXCLUDED.first_seen_at),
       last_seen_at = GREATEST(bug_clusters.last_seen_at, EXCLUDED.last_seen_at),
       occurrence_count = EXCLUDED.occurrence_count,
       affected_test_count = EXCLUDED.affected_test_count,
       affected_page_count = EXCLUDED.affected_page_count,
       affected_endpoint_count = EXCLUDED.affected_endpoint_count,
       regression_status = EXCLUDED.regression_status,
       primary_run_id = EXCLUDED.primary_run_id,
       primary_investigation_id = EXCLUDED.primary_investigation_id,
       primary_failure_signature = EXCLUDED.primary_failure_signature,
       root_cause_summary = EXCLUDED.root_cause_summary,
       updated_at = NOW()
     RETURNING *`,
    [
      input.fingerprintKey,
      input.title,
      input.description,
      input.status,
      input.severity,
      input.confidence,
      input.firstSeenAt,
      input.lastSeenAt,
      input.occurrenceCount,
      input.affectedTestCount,
      input.affectedPageCount,
      input.affectedEndpointCount,
      input.regressionStatus,
      input.primaryRunId,
      input.primaryInvestigationId,
      input.primaryFailureSignature,
      input.rootCauseSummary,
    ],
  );
  return rows[0]!;
}

export async function upsertMember(
  exec: Executor,
  clusterId: string,
  testRunId: string,
  similarityScore: number,
  reason: SimilaritySignal[],
): Promise<void> {
  await exec.query(
    `INSERT INTO bug_cluster_members (cluster_id, test_run_id, similarity_score, membership_reason)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (cluster_id, test_run_id) DO UPDATE SET
       similarity_score = EXCLUDED.similarity_score,
       membership_reason = EXCLUDED.membership_reason`,
    [clusterId, testRunId, similarityScore, JSON.stringify(reason)],
  );
}

export async function listClusters(
  exec: Executor,
  opts: {
    page: number;
    limit: number;
    status?: ClusterStatus;
    severity?: string;
    regressionStatus?: RegressionStatus;
  },
): Promise<{ items: BugClusterRow[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const filters: string[] = [];
  const params: unknown[] = [];
  if (opts.status) {
    params.push(opts.status);
    filters.push(`status = $${params.length}`);
  }
  if (opts.severity) {
    params.push(opts.severity);
    filters.push(`severity = $${params.length}`);
  }
  if (opts.regressionStatus) {
    params.push(opts.regressionStatus);
    filters.push(`regression_status = $${params.length}`);
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  params.push(opts.limit, offset);
  const items = await exec.query<BugClusterRow>(
    `SELECT * FROM bug_clusters ${where} ORDER BY last_seen_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const countRes = await exec.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM bug_clusters ${where}`,
    params.slice(0, filters.length),
  );
  return { items: items.rows, total: Number(countRes.rows[0]!.count) };
}

export async function getClusterById(
  exec: Executor,
  id: string,
): Promise<BugClusterRow | null> {
  const { rows } = await exec.query<BugClusterRow>('SELECT * FROM bug_clusters WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function getClusterByFingerprintKey(
  exec: Executor,
  key: string,
): Promise<BugClusterRow | null> {
  const { rows } = await exec.query<BugClusterRow>(
    'SELECT * FROM bug_clusters WHERE fingerprint_key = $1',
    [key],
  );
  return rows[0] ?? null;
}

export async function listMembersForCluster(
  exec: Executor,
  clusterId: string,
): Promise<BugClusterMemberRow[]> {
  const { rows } = await exec.query<BugClusterMemberRow>(
    'SELECT * FROM bug_cluster_members WHERE cluster_id = $1 ORDER BY created_at ASC',
    [clusterId],
  );
  return rows;
}

export async function listClusterIdsForRuns(
  exec: Executor,
  runIds: string[],
): Promise<string[]> {
  if (runIds.length === 0) return [];
  const { rows } = await exec.query<{ test_run_id: string }>(
    'SELECT DISTINCT test_run_id FROM bug_cluster_members WHERE test_run_id = ANY($1::uuid[])',
    [runIds],
  );
  return rows.map((r) => r.test_run_id);
}

export function mapClusterRow(row: BugClusterRow): BugCluster {
  return {
    id: row.id,
    fingerprintKey: row.fingerprint_key,
    title: row.title,
    description: row.description,
    status: row.status,
    severity: (row.severity as BugCluster['severity']) ?? 'unknown',
    confidence: Number(row.confidence),
    firstSeenAt: row.first_seen_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    occurrenceCount: row.occurrence_count,
    affectedTestCount: row.affected_test_count,
    affectedPageCount: row.affected_page_count,
    affectedEndpointCount: row.affected_endpoint_count,
    regressionStatus: row.regression_status,
    primaryRunId: row.primary_run_id,
    primaryInvestigationId: row.primary_investigation_id,
    primaryFailureSignature: row.primary_failure_signature,
    rootCauseSummary: row.root_cause_summary,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapMemberRow(row: BugClusterMemberRow): BugClusterMember {
  return {
    clusterId: row.cluster_id,
    testRunId: row.test_run_id,
    similarityScore: Number(row.similarity_score),
    membershipReason: Array.isArray(row.membership_reason)
      ? row.membership_reason
      : (row.membership_reason as unknown as SimilaritySignal[]),
    createdAt: row.created_at.toISOString(),
  };
}
