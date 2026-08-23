import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from './Dashboard.js';

function makeOverview(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    qualityScore: {
      score: 87,
      sampleSize: 42,
      computedAt: new Date().toISOString(),
      breakdown: {},
    },
    applications: { count: 3 },
    testRuns: { totalRecent: 42, passed: 40, failed: 2, errored: 0, avgDurationMs: 123 },
    bugs: { openClusters: 4, regressed: 1, severityCounts: { critical: 1, high: 3 } },
    flakyTests: { count: 2 },
    recentCampaign: null,
    aiMetrics: {
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      provider: null,
      model: null,
      byOperation: {},
    },
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;

function installFetchMock(overview: Record<string, unknown>): void {
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = url.toString();
    if (u.includes('/api/auth/me')) {
      return new Response(
        JSON.stringify({ user: { id: 'u1', email: 'e@x', role: 'admin' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (u.includes('/api/dashboard/overview')) {
      return new Response(JSON.stringify(overview), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (u.includes('/api/dashboard/trends')) {
      return new Response(
        JSON.stringify({ metric: 'qualityScore', window: '30d', buckets: [], insufficient: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (u.includes('/api/ai/bug-intelligence/clusters')) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (u.includes('/api/test-runs')) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (u.includes('/api/applications')) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  installFetchMock(makeOverview());
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Dashboard', () => {
  it('renders quality score when data present', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('87')).toBeInTheDocument());
    expect(screen.getAllByText(/Pass Rate/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Open Bugs/i)).toBeInTheDocument();
  });

  it('renders insufficient-data quality state when sampleSize is 0', async () => {
    installFetchMock(
      makeOverview({
        qualityScore: {
          score: 0,
          sampleSize: 0,
          computedAt: new Date().toISOString(),
          breakdown: {},
        },
      }),
    );
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText(/Not enough historical data/i)).toBeInTheDocument(),
    );
  });
});
