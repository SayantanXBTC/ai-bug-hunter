import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from './Dashboard.js';

function makeOverview(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    qualityScore: {
      score: 87,
      sampleSize: 42,
      computedAt: new Date().toISOString(),
      breakdown: {},
      ...(overrides.qualityScore ?? {}),
    },
    applications: { count: 3 },
    testRuns: { totalRecent: 42, passed: 40, failed: 2, errored: 0, avgDurationMs: 123 },
    bugs: { openClusters: 4, regressed: 1, severityCounts: { critical: 1, high: 3 } },
    flakyTests: { count: 2 },
    recentCampaign: null,
    aiMetrics: { requestCount: 0, successCount: 0, failureCount: 0, provider: null, model: null },
  };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = url.toString();
    if (u.includes('/api/dashboard/overview')) {
      return new Response(JSON.stringify(makeOverview()), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('/api/dashboard/trends')) {
      return new Response(
        JSON.stringify({ metric: 'passRate', window: '30d', buckets: [], insufficient: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (u.includes('/api/bug-intelligence/clusters')) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Dashboard', () => {
  it('renders quality score and KPI cards', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('87')).toBeInTheDocument());
    expect(screen.getByText(/Recent tests/i)).toBeInTheDocument();
    expect(screen.getByText(/Open bugs/i)).toBeInTheDocument();
  });

  it('shows insufficient data fallback for trends', async () => {
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText(/Not enough historical data/i)).toBeInTheDocument(),
    );
  });
});
