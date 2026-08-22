import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge.js';

describe('StatusBadge', () => {
  it('shows loading state', () => {
    render(<StatusBadge health={{ status: 'loading' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/checking system status/i);
  });

  it('shows online state', () => {
    render(<StatusBadge health={{ status: 'ok' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/system online/i);
  });

  it('shows error state', () => {
    render(<StatusBadge health={{ status: 'error' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/api unreachable/i);
  });
});
