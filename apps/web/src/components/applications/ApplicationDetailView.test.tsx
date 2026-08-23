import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ApplicationDetailView } from './ApplicationDetailView.js';
import type { ApplicationRow } from './types.js';

const originalFetch = globalThis.fetch;

const app: ApplicationRow = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Sample App',
  base_url: 'https://example.com',
  description: null,
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  globalThis.fetch = vi.fn(async () =>
    new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('ApplicationDetailView delete flow', () => {
  it('shows Delete button for qa_engineer and opens confirmation modal', () => {
    render(
      <ApplicationDetailView
        application={app}
        role="qa_engineer"
        onBack={() => undefined}
        onGenerateTests={() => undefined}
      />,
    );
    const del = screen.getByLabelText('Delete application');
    expect(del).toBeTruthy();
    fireEvent.click(del);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Delete "Sample App"/)).toBeTruthy();
  });

  it('surfaces 409 conflict message when app has children', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'application_has_children',
            message: 'Application has 3 test case(s) and 5 test run(s). Delete them first.',
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    render(
      <ApplicationDetailView
        application={app}
        role="qa_engineer"
        onBack={() => undefined}
        onGenerateTests={() => undefined}
      />,
    );
    fireEvent.click(screen.getByLabelText('Delete application'));
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/test case/);
    });
  });

  it('calls onDeleted on 204', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    const onDeleted = vi.fn();
    render(
      <ApplicationDetailView
        application={app}
        role="admin"
        onBack={() => undefined}
        onGenerateTests={() => undefined}
        onDeleted={onDeleted}
      />,
    );
    fireEvent.click(screen.getByLabelText('Delete application'));
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it('hides Delete button for viewer role', () => {
    render(
      <ApplicationDetailView
        application={app}
        role="viewer"
        onBack={() => undefined}
        onGenerateTests={() => undefined}
      />,
    );
    expect(screen.queryByLabelText('Delete application')).toBeNull();
  });
});
