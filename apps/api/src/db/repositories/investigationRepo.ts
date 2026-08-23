import type { Pool, PoolClient } from 'pg';
import type { InvestigationReport } from '../../ai/investigation/investigationTypes.js';

export interface InvestigationRecord {
  id: string;
  test_run_id: string;
  classification: string;
  severity: string;
  confidence: string; // NUMERIC returned as string
  summary: string;
  likely_root_cause: string | null;
  provider: string;
  model: string;
  report_json: InvestigationReport;
  created_at: Date;
}

type Executor = Pool | PoolClient;

export async function upsertInvestigation(
  exec: Executor,
  report: InvestigationReport,
): Promise<InvestigationRecord> {
  await exec.query('DELETE FROM investigations WHERE test_run_id = $1', [report.testRunId]);
  const { rows } = await exec.query<InvestigationRecord>(
    `INSERT INTO investigations
      (test_run_id, classification, severity, confidence, summary,
       likely_root_cause, provider, model, report_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      report.testRunId,
      report.classification,
      report.severity,
      report.confidence,
      report.summary,
      report.likelyRootCause,
      report.provider,
      report.model,
      report,
    ],
  );
  return rows[0]!;
}

export async function getInvestigationByTestRunId(
  exec: Executor,
  testRunId: string,
): Promise<InvestigationRecord | null> {
  const { rows } = await exec.query<InvestigationRecord>(
    'SELECT * FROM investigations WHERE test_run_id = $1',
    [testRunId],
  );
  return rows[0] ?? null;
}

export async function deleteInvestigationByTestRunId(
  exec: Executor,
  testRunId: string,
): Promise<void> {
  await exec.query('DELETE FROM investigations WHERE test_run_id = $1', [testRunId]);
}
