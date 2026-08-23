import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ApplicationsView } from './ApplicationsView.js';

const originalFetch = globalThis.fetch;

function installFetchMock(items: Array<Record<string, unknown>>): void {
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = url.toString();
    if (u.includes('/api/applications')) {
      return new Response(
        JSON.stringify({ items, page: 1, limit: 100, total: items.length }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (u.includes('/api/test-cases')) {
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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

describe('ApplicationsView', () => {
  it('renders empty state when no applications', async () => {
    render(<ApplicationsView role="qa_engineer" onNavigateToTests={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByText(/No applications yet/i)).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/Add Application/i).length).toBeGreaterThan(0);
  });

  it('renders rows when list non-empty', async () => {
    installFetchMock([
      { id: 'a1', name: 'Acme Web', base_url: 'https://acme.example.com' },
      { id: 'a2', name: 'Beta App', base_url: 'https://beta.example.com' },
    ]);
    render(<ApplicationsView role="qa_engineer" onNavigateToTests={() => undefined} />);
    await waitFor(() => expect(screen.getByText('Acme Web')).toBeInTheDocument());
    expect(screen.getByText('Beta App')).toBeInTheDocument();
    expect(screen.getAllByText(/View/i).length).toBeGreaterThanOrEqual(2);
  });
});
