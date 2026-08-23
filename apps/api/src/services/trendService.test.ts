import { describe, it, expect } from 'vitest';
import { buildDayBuckets, computeTrend, type TrendRun } from './trendService.js';

const NOW = new Date('2026-08-23T12:00:00Z');

function runAt(iso: string, status: TrendRun['status'], durationMs = 100): TrendRun {
  return { createdAt: new Date(iso), status, durationMs };
}

describe('trendService', () => {
  it('buildDayBuckets produces N consecutive day buckets ending today', () => {
    const buckets = buildDayBuckets(NOW, 7);
    expect(buckets).toHaveLength(7);
    expect(buckets[6]!.startIso).toBe('2026-08-23T00:00:00.000Z');
    expect(buckets[6]!.endIso).toBe('2026-08-24T00:00:00.000Z');
    expect(buckets[0]!.startIso).toBe('2026-08-17T00:00:00.000Z');
  });

  it('marks insufficient=true when fewer than 3 buckets have data', () => {
    const res = computeTrend('passRate', '7d', { runs: [runAt('2026-08-23T04:00:00Z', 'passed')], now: NOW });
    expect(res.insufficient).toBe(true);
    expect(res.buckets).toHaveLength(7);
  });

  it('computes per-day passRate correctly', () => {
    const runs: TrendRun[] = [
      runAt('2026-08-21T06:00:00Z', 'passed'),
      runAt('2026-08-21T07:00:00Z', 'failed'),
      runAt('2026-08-22T06:00:00Z', 'passed'),
      runAt('2026-08-22T07:00:00Z', 'passed'),
      runAt('2026-08-23T06:00:00Z', 'failed'),
    ];
    const res = computeTrend('passRate', '7d', { runs, now: NOW });
    expect(res.insufficient).toBe(false);
    // day 4 = 2026-08-21 (index 4), passRate = 0.5
    const day21 = res.buckets.find((b) => b.startIso.startsWith('2026-08-21'))!;
    expect(day21.value).toBeCloseTo(0.5, 5);
    const day22 = res.buckets.find((b) => b.startIso.startsWith('2026-08-22'))!;
    expect(day22.value).toBe(1);
    const day23 = res.buckets.find((b) => b.startIso.startsWith('2026-08-23'))!;
    expect(day23.value).toBe(0);
  });

  it('computes avgDuration per day', () => {
    const runs: TrendRun[] = [
      runAt('2026-08-23T01:00:00Z', 'passed', 100),
      runAt('2026-08-23T02:00:00Z', 'passed', 200),
    ];
    const res = computeTrend('avgDuration', '7d', { runs, now: NOW });
    const day23 = res.buckets.find((b) => b.startIso.startsWith('2026-08-23'))!;
    expect(day23.value).toBe(150);
  });
});
