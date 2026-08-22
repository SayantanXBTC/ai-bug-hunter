import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState.js';

describe('EmptyState', () => {
  it('renders provided text', () => {
    render(<EmptyState text="No test runs yet." />);
    expect(screen.getByText('No test runs yet.')).toBeInTheDocument();
  });
});
