import { describe, it, expect } from 'vitest';
import type { ApplicationModel } from '@ai-bug-hunter/test-engine';
import { compactApplicationModel } from './modelCompactor.js';

function bigModel(): ApplicationModel {
  return {
    id: 'x',
    baseUrl: 'http://a.test/',
    discoveredAt: new Date().toISOString(),
    pages: Array.from({ length: 25 }, (_, i) => ({
      url: `http://a.test/p${i}`,
      path: `/p${i}`,
      title: `T${i}`,
      discoveredAt: new Date().toISOString(),
      headings: Array.from({ length: 30 }, (_, h) => ({ level: 1, text: `H${h}` })),
      links: Array.from({ length: 50 }, (_, l) => ({
        text: `L${l}`,
        href: `/p${l}`,
        normalizedUrl: `http://a.test/p${l}`,
        inScope: true,
        selectors: [{ strategy: 'css', value: `.link-${l}`, confidence: 0.6, unique: true }],
      })),
      elements: Array.from({ length: 100 }, (_, e) => ({
        category: 'button' as const,
        tagName: 'button',
        visible: true,
        enabled: true,
        selectors: [
          { strategy: 'testId', value: `[data-testid="b-${e}"]`, confidence: 0.98, unique: true },
          { strategy: 'role', value: `role=button[name="B${e}"]`, confidence: 0.95, unique: false },
          { strategy: 'label', value: `label=B${e}`, confidence: 0.9, unique: false },
          { strategy: 'css', value: `.b-${e}`, confidence: 0.6, unique: true },
        ],
      })),
      forms: [],
      accessibility: { root: null, nodeCount: 0, truncated: false },
    })),
  };
}

describe('compactApplicationModel', () => {
  it('caps pages, elements, links, selectors', () => {
    const c = compactApplicationModel(bigModel());
    expect(c.pages.length).toBeLessThanOrEqual(10);
    for (const p of c.pages) {
      expect(p.elements.length).toBeLessThanOrEqual(40);
      expect(p.links.length).toBeLessThanOrEqual(20);
      for (const e of p.elements) expect(e.selectors.length).toBeLessThanOrEqual(3);
    }
  });

  it('filters to targetPage when supplied', () => {
    const c = compactApplicationModel(bigModel(), undefined, '/p3');
    expect(c.pages).toHaveLength(1);
    expect(c.pages[0]!.path).toBe('/p3');
  });

  it('drops out-of-scope links from context', () => {
    const m = bigModel();
    m.pages[0]!.links.push({
      text: 'external',
      href: 'https://other.test/',
      normalizedUrl: 'https://other.test/',
      inScope: false,
      selectors: [],
    });
    const c = compactApplicationModel(m);
    expect(c.pages[0]!.links.every((l) => l.inScope)).toBe(true);
  });
});
