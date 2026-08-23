import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TestsView } from './TestsView.js';

const originalFetch = globalThis.fetch;

function installFetchMock(testCases: Array<Record<string, unknown>>): void {
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = url.toString();
    if (u.includes('/api/test-cases')) {
      return new Response(
        JSON.stringify({
          items: testCases,
          page: 1,
          limit: 100,
          total: testCases.length,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (u.includes('/api/applications')) {
      return new Response(
        JSON.stringify({
          items: [{ id: 'app1', name: 'Demo App', base_url: 'https://demo.example.com' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (u.includes('/api/test-runs')) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (u.includes('/api/ai/test-reliability')) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  installFetchMock([]);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('TestsView', () => {
  it('renders the empty state when there are no tests', async () => {
    render(<TestsView role="qa_engineer" />);
    await waitFor(() => expect(screen.getByText(/No tests yet/i)).toBeInTheDocument());
    expect(screen.getAllByText(/Generate Tests/i).length).toBeGreaterThan(0);
  });

  it('renders rows with source pills for AI and manual tests', async () => {
    installFetchMock([
      {
        id: 't1',
        application_id: 'app1',
        name: 'Login smoke',
        description: null,
        target_url: 'https://demo.example.com/login',
        definition: { id: 'ext-1', name: 'Login smoke', targetUrl: 'https://demo.example.com/login', steps: [{ action: 'navigate', url: 'https://demo.example.com/login' }] },
        priority: 'medium',
        enabled: true,
        tags: ['ai-generated'],
        source: 'generated',
        external_test_id: 'ext-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 't2',
        application_id: 'app1',
        name: 'Manual checkout',
        description: null,
        target_url: 'https://demo.example.com/cart',
        definition: { id: 'ext-2', name: 'Manual checkout', targetUrl: 'https://demo.example.com/cart', steps: [{ action: 'navigate', url: 'https://demo.example.com/cart' }] },
        priority: 'high',
        enabled: true,
        tags: [],
        source: 'manual',
        external_test_id: 'ext-2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    render(<TestsView role="qa_engineer" />);
    await waitFor(() => expect(screen.getByText('Login smoke')).toBeInTheDocument());
    expect(screen.getByText('Manual checkout')).toBeInTheDocument();
    expect(screen.getAllByText(/AI Generated/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^Manual$/i).length).toBeGreaterThanOrEqual(1);
  });
});
