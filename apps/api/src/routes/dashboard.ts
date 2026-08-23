import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import { pool } from '../db/pool.js';
import { requireUser } from '../middleware/authenticate.js';
import { computeQualityScore } from '../services/qualityScoreService.js';
import { computeTrend, type TrendRun, type TrendCluster, type TrendReliability } from '../services/trendService.js';
import { getAiMetricsSnapshot } from '../ai/metrics/aiMetrics.js';
import type { DashboardOverviewResponse, TrendMetric, TrendResponse } from '@ai-bug-hunter/shared';

export const dashboardRouter = Router();

const OverviewQuery = z.object({
  applicationId: z.string().uuid().optional(),
});

const RECENT_RUN_LIMIT = 100;

/**
 * Build an ownership WHERE fragment scoped to the calling user.
 * - Admins bypass the filter entirely (returns empty string).
 * - Non-admins get `AND owner_id = $N` appended.
 *
 * The caller supplies the current param array so the placeholder index is
 * correct. Mutates the array in place if a param is added.
 */
function ownerFilter(userId: string, isAdmin: boolean, params: unknown[], prefix: string): string {
  if (isAdmin) return '';
  params.push(userId);
  return `${prefix} owner_id = $${params.length}`;
}

dashboardRouter.get(
  '/dashboard/overview',
  requireUser,
  async (req: Request, res: Response<DashboardOverviewResponse>, next: NextFunction) => {
    const parsed = OverviewQuery.safeParse(req.query);
    if (!parsed.success) return next(new HttpError(400, 'Invalid query parameters'));
    try {
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'admin';
      const applicationId = parsed.data.applicationId;
      const qualityScore = await computeQualityScore(pool, {
        ...(applicationId ? { applicationId } : {}),
        userId,
        isAdmin,
      });

      // Applications count.
      {
        // scoped
      }
      const appsParams: unknown[] = [];
      const appsFilter = ownerFilter(userId, isAdmin, appsParams, 'WHERE');
      const appsCountRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM applications ${appsFilter}`,
        appsParams,
      );
      const appsCount = Number(appsCountRes.rows[0]!.count);

      // Recent test runs.
      const runsParams: unknown[] = [];
      const runsFilter = ownerFilter(userId, isAdmin, runsParams, 'WHERE');
      runsParams.push(RECENT_RUN_LIMIT);
      const runsRes = await pool.query<{
        status: 'passed' | 'failed' | 'error';
        duration_ms: number;
      }>(
        `SELECT status, duration_ms FROM test_runs
         ${runsFilter}
         ORDER BY created_at DESC LIMIT $${runsParams.length}`,
        runsParams,
      );
      let passed = 0, failed = 0, errored = 0, totalDuration = 0;
      for (const r of runsRes.rows) {
        if (r.status === 'passed') passed += 1;
        else if (r.status === 'failed') failed += 1;
        else if (r.status === 'error') errored += 1;
        totalDuration += Number(r.duration_ms) || 0;
      }
      const totalRecent = runsRes.rows.length;
      const avgDurationMs = totalRecent === 0 ? 0 : Math.round(totalDuration / totalRecent);

      // Bug clusters.
      const clustersParams: unknown[] = [];
      const clustersFilter = ownerFilter(userId, isAdmin, clustersParams, 'WHERE');
      const clustersRes = await pool.query<{ status: string; regression_status: string; severity: string }>(
        `SELECT status, regression_status, severity FROM bug_clusters ${clustersFilter}`,
        clustersParams,
      );
      const openClusters = clustersRes.rows.filter((c) => c.status !== 'resolved').length;
      const regressed = clustersRes.rows.filter(
        (c) => c.regression_status === 'regressed' && c.status !== 'resolved',
      ).length;
      const severityCounts: Record<string, number> = {};
      for (const c of clustersRes.rows) {
        if (c.status === 'resolved') continue;
        severityCounts[c.severity] = (severityCounts[c.severity] ?? 0) + 1;
      }

      // Flaky tests count — scoped by joining test_reliability_snapshots to
      // test_runs.owner_id via external_test_id. Reliability rows themselves
      // do not carry owner_id, so we intersect against the caller's runs.
      let flakyCount: number;
      if (isAdmin) {
        const flakyRes = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM test_reliability_snapshots
           WHERE status IN ('flaky','suspected_flaky')`,
        );
        flakyCount = Number(flakyRes.rows[0]!.count);
      } else {
        const flakyRes = await pool.query<{ count: string }>(
          `SELECT COUNT(DISTINCT s.external_test_id)::text AS count
           FROM test_reliability_snapshots s
           WHERE s.status IN ('flaky','suspected_flaky')
             AND EXISTS (
               SELECT 1 FROM test_runs r
               WHERE r.external_test_id = s.external_test_id
                 AND r.owner_id = $1
             )`,
          [userId],
        );
        flakyCount = Number(flakyRes.rows[0]!.count);
      }

      // Most recent regression campaign.
      const campaignParams: unknown[] = [];
      const campaignFilter = ownerFilter(userId, isAdmin, campaignParams, 'WHERE');
      const campaignRes = await pool.query<{
        id: string;
        name: string;
        quality: string | null;
        passed_runs: number;
        failed_runs: number;
        created_at: Date;
      }>(
        `SELECT id, name, quality, passed_runs, failed_runs, created_at
         FROM regression_campaigns
         ${campaignFilter}
         ORDER BY created_at DESC LIMIT 1`,
        campaignParams,
      );
      const recentCampaign = campaignRes.rows[0]
        ? {
            id: campaignRes.rows[0].id,
            name: campaignRes.rows[0].name,
            quality: campaignRes.rows[0].quality,
            passed: campaignRes.rows[0].passed_runs,
            failed: campaignRes.rows[0].failed_runs,
            createdAt: campaignRes.rows[0].created_at.toISOString(),
          }
        : null;

      const ai = getAiMetricsSnapshot();

      res.json({
        qualityScore,
        applications: { count: appsCount },
        testRuns: { totalRecent, passed, failed, errored, avgDurationMs },
        bugs: { openClusters, regressed, severityCounts },
        flakyTests: { count: flakyCount },
        recentCampaign,
        aiMetrics: {
          requestCount: ai.requestCount,
          successCount: ai.successCount,
          failureCount: ai.failureCount,
          provider: ai.provider,
          model: ai.model,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

const TrendsQuery = z.object({
  applicationId: z.string().uuid().optional(),
  metric: z.enum([
    'passRate',
    'failureRate',
    'flakyRate',
    'qualityScore',
    'bugCount',
    'regressionCount',
    'avgDuration',
  ]),
  window: z.enum(['7d', '30d', '90d']).default('30d'),
});

dashboardRouter.get(
  '/dashboard/trends',
  requireUser,
  async (req: Request, res: Response<TrendResponse>, next: NextFunction) => {
    const parsed = TrendsQuery.safeParse(req.query);
    if (!parsed.success) return next(new HttpError(400, 'Invalid trend query'));
    const { metric, window } = parsed.data;
    try {
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'admin';
      const days = window === '7d' ? 7 : window === '30d' ? 30 : 90;
      const sinceIso = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();

      const runsParams: unknown[] = [sinceIso];
      const runsScope = ownerFilter(userId, isAdmin, runsParams, 'AND');
      const runsRes = await pool.query<{
        created_at: Date;
        status: 'passed' | 'failed' | 'error';
        duration_ms: number;
      }>(
        `SELECT created_at, status, duration_ms FROM test_runs
         WHERE created_at >= $1 ${runsScope}
         ORDER BY created_at ASC LIMIT 10000`,
        runsParams,
      );
      const runs: TrendRun[] = runsRes.rows.map((r) => ({
        createdAt: r.created_at,
        status: r.status,
        durationMs: Number(r.duration_ms) || 0,
      }));

      let clusters: TrendCluster[] = [];
      if (metric === 'bugCount' || metric === 'regressionCount') {
        const cParams: unknown[] = [sinceIso];
        const cScope = ownerFilter(userId, isAdmin, cParams, 'AND');
        const cRes = await pool.query<{ created_at: Date; regression_status: string; status: string }>(
          `SELECT created_at, regression_status, status FROM bug_clusters
           WHERE created_at >= $1 ${cScope}`,
          cParams,
        );
        clusters = cRes.rows.map((c) => ({
          createdAt: c.created_at,
          regressionStatus: c.regression_status,
          status: c.status,
        }));
      }

      let reliability: TrendReliability[] = [];
      if (metric === 'flakyRate') {
        // Reliability snapshots have no owner_id — intersect via test_runs for
        // non-admins so trend is per-tenant.
        if (isAdmin) {
          const rRes = await pool.query<{ status: string; calculated_at: Date }>(
            `SELECT status, calculated_at FROM test_reliability_snapshots WHERE calculated_at >= $1`,
            [sinceIso],
          );
          reliability = rRes.rows.map((r) => ({ status: r.status, calculatedAt: r.calculated_at }));
        } else {
          const rRes = await pool.query<{ status: string; calculated_at: Date }>(
            `SELECT s.status, s.calculated_at
             FROM test_reliability_snapshots s
             WHERE s.calculated_at >= $1
               AND EXISTS (
                 SELECT 1 FROM test_runs r
                 WHERE r.external_test_id = s.external_test_id
                   AND r.owner_id = $2
               )`,
            [sinceIso, userId],
          );
          reliability = rRes.rows.map((r) => ({ status: r.status, calculatedAt: r.calculated_at }));
        }
      }

      const result = computeTrend(metric as TrendMetric, window, { runs, clusters, reliability });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
