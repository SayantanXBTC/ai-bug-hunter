import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from './MetricCard.js';

describe('MetricCard', () => {
  it('renders label, value, and hint', () => {
    render(<MetricCard label="Pass Rate" value="95%" hint="19/20 recent" />);
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('19/20 recent')).toBeInTheDocument();
  });

  it('renders an AI accent dot when aiAccent is set', () => {
    const { container } = render(<MetricCard label="AI" value={5} aiAccent />);
    const dot = container.querySelector('span.bg-violet-500');
    expect(dot).not.toBeNull();
  });
});
