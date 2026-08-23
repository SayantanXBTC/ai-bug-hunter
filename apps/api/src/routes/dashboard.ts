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

dashboardRouter.get(
  '/dashboard/overview',
  requireUser,
  async (req: Request, res: Response<DashboardOverviewResponse>, next: NextFunction) => {
    const parsed = OverviewQuery.safeParse(req.query);
    if (!parsed.success) return next(new HttpError(400, 'Invalid query parameters'));
    try {
      const applicationId = parsed.data.applicationId;
      const qualityScore = await computeQualityScore(pool, applicationId ? { applicationId } : {});

      const appsCountRes = await pool.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM applications',
      );
      const appsCount = Number(appsCountRes.rows[0]!.count);

      const runsRes = await pool.query<{
        status: 'passed' | 'failed' | 'error';
        duration_ms: number;
      }>(
        `SELECT status, duration_ms FROM test_runs
         ORDER BY created_at DESC LIMIT $1`,
        [RECENT_RUN_LIMIT],
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

      const clustersRes = await pool.query<{ status: string; regression_status: string; severity: string }>(
        `SELECT status, regression_status, severity FROM bug_clusters`,
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

      const flakyRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM test_reliability_snapshots
         WHERE status IN ('flaky','suspected_flaky')`,
      );
      const flakyCount = Number(flakyRes.rows[0]!.count);

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
         ORDER BY created_at DESC LIMIT 1`,
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
      const days = window === '7d' ? 7 : window === '30d' ? 30 : 90;
      const sinceIso = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();

      const runsRes = await pool.query<{
        created_at: Date;
        status: 'passed' | 'failed' | 'error';
        duration_ms: number;
      }>(
        `SELECT created_at, status, duration_ms FROM test_runs
         WHERE created_at >= $1
         ORDER BY created_at ASC LIMIT 10000`,
        [sinceIso],
      );
      const runs: TrendRun[] = runsRes.rows.map((r) => ({
        createdAt: r.created_at,
        status: r.status,
        durationMs: Number(r.duration_ms) || 0,
      }));

      let clusters: TrendCluster[] = [];
      if (metric === 'bugCount' || metric === 'regressionCount') {
        const cRes = await pool.query<{ created_at: Date; regression_status: string; status: string }>(
          `SELECT created_at, regression_status, status FROM bug_clusters WHERE created_at >= $1`,
          [sinceIso],
        );
        clusters = cRes.rows.map((c) => ({
          createdAt: c.created_at,
          regressionStatus: c.regression_status,
          status: c.status,
        }));
      }

      let reliability: TrendReliability[] = [];
      if (metric === 'flakyRate') {
        const rRes = await pool.query<{ status: string; calculated_at: Date }>(
          `SELECT status, calculated_at FROM test_reliability_snapshots WHERE calculated_at >= $1`,
          [sinceIso],
        );
        reliability = rRes.rows.map((r) => ({ status: r.status, calculatedAt: r.calculated_at }));
      }

      const result = computeTrend(metric as TrendMetric, window, { runs, clusters, reliability });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
