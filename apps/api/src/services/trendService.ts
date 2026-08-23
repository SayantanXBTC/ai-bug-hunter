import type { TrendBucket, TrendMetric, TrendResponse } from '@ai-bug-hunter/shared';

export interface TrendRun {
  createdAt: Date;
  status: 'passed' | 'failed' | 'error';
  durationMs: number;
}

export interface TrendCluster {
  createdAt: Date;
  regressionStatus: string;
  status: string;
}

export interface TrendReliability {
  status: string;
  calculatedAt: Date;
}

const WINDOW_DAYS: Record<'7d' | '30d' | '90d', number> = { '7d': 7, '30d': 30, '90d': 90 };

export function windowDays(window: '7d' | '30d' | '90d'): number {
  return WINDOW_DAYS[window];
}

export function bucketStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function buildDayBuckets(now: Date, days: number): Array<{ startIso: string; endIso: string; start: Date; end: Date }> {
  const buckets: Array<{ startIso: string; endIso: string; start: Date; end: Date }> = [];
  const today = bucketStart(now);
  for (let i = days - 1; i >= 0; i -= 1) {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - i);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    buckets.push({
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      start,
      end,
    });
  }
  return buckets;
}

function runsInBucket(runs: TrendRun[], start: Date, end: Date): TrendRun[] {
  return runs.filter((r) => r.createdAt >= start && r.createdAt < end);
}

export function computeTrend(
  metric: TrendMetric,
  window: '7d' | '30d' | '90d',
  data: {
    runs: TrendRun[];
    clusters?: TrendCluster[];
    reliability?: TrendReliability[];
    now?: Date;
  },
): TrendResponse {
  const days = windowDays(window);
  const now = data.now ?? new Date();
  const bucketDefs = buildDayBuckets(now, days);

  const buckets: TrendBucket[] = bucketDefs.map((b) => {
    const dayRuns = runsInBucket(data.runs, b.start, b.end);
    let value = 0;
    let sampleSize = dayRuns.length;

    switch (metric) {
      case 'passRate': {
        if (dayRuns.length > 0) {
          value = dayRuns.filter((r) => r.status === 'passed').length / dayRuns.length;
        }
        break;
      }
      case 'failureRate': {
        if (dayRuns.length > 0) {
          value = dayRuns.filter((r) => r.status !== 'passed').length / dayRuns.length;
        }
        break;
      }
      case 'avgDuration': {
        if (dayRuns.length > 0) {
          const sum = dayRuns.reduce((a, r) => a + r.durationMs, 0);
          value = sum / dayRuns.length;
        }
        break;
      }
      case 'qualityScore': {
        if (dayRuns.length > 0) {
          const pr = dayRuns.filter((r) => r.status === 'passed').length / dayRuns.length;
          value = Math.round(100 * pr);
        }
        break;
      }
      case 'bugCount': {
        const dayClusters = (data.clusters ?? []).filter(
          (c) => c.createdAt >= b.start && c.createdAt < b.end,
        );
        value = dayClusters.length;
        sampleSize = dayClusters.length;
        break;
      }
      case 'regressionCount': {
        const dayClusters = (data.clusters ?? []).filter(
          (c) => c.createdAt >= b.start && c.createdAt < b.end && c.regressionStatus === 'regressed',
        );
        value = dayClusters.length;
        sampleSize = dayClusters.length;
        break;
      }
      case 'flakyRate': {
        const dayReliability = (data.reliability ?? []).filter(
          (r) => r.calculatedAt >= b.start && r.calculatedAt < b.end,
        );
        if (dayReliability.length > 0) {
          const flaky = dayReliability.filter(
            (r) => r.status === 'flaky' || r.status === 'suspected_flaky',
          ).length;
          value = flaky / dayReliability.length;
        }
        sampleSize = dayReliability.length;
        break;
      }
    }

    return {
      startIso: b.startIso,
      endIso: b.endIso,
      value,
      sampleSize,
    };
  });

  const populated = buckets.filter((b) => b.sampleSize > 0).length;
  return {
    metric,
    window,
    buckets,
    insufficient: populated < 3,
  };
}
