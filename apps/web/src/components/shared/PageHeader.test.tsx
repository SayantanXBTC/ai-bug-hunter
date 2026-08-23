import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader.js';

describe('PageHeader', () => {
  it('renders eyebrow, title, subtitle, and actions', () => {
    render(
      <PageHeader
        eyebrow="EXECUTION TELEMETRY"
        title="Test Runs"
        subtitle="Autonomous QA runs."
        actions={<button type="button">Refresh</button>}
      />,
    );
    expect(screen.getByText('EXECUTION TELEMETRY')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Test Runs' })).toBeInTheDocument();
    expect(screen.getByText('Autonomous QA runs.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });
});
