import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserManager } from '../browser/browserManager.js';
import { DiscoveryEngine } from './discoveryEngine.js';
import { startFixtureServer, type FixtureServer } from '../test/fixtureServer.js';

let fixture: FixtureServer;
let manager: BrowserManager;
let engine: DiscoveryEngine;

beforeAll(async () => {
  fixture = await startFixtureServer();
  manager = new BrowserManager({ headless: true });
  await manager.launch();
  engine = new DiscoveryEngine({ browserManager: manager });
});

afterAll(async () => {
  await manager.close();
  await fixture.close();
});

function hubUrl(): string {
  return `${fixture.url.replace(/\/$/, '')}/app/hub`;
}

describe('DiscoveryEngine — single page', () => {
  it('discovers login form fields, buttons, labels, testIds', async () => {
    const r = await engine.discover({
      baseUrl: `${fixture.url.replace(/\/$/, '')}/app/login`,
      maxPages: 1,
      maxDepth: 0,
    });
    expect(r.application.pages).toHaveLength(1);
    const p = r.application.pages[0]!;
    expect(p.title).toBe('Login');
    expect(p.headings.some((h) => h.text === 'Sign In')).toBe(true);
    expect(p.forms).toHaveLength(1);
    const form = p.forms[0]!;
    expect(form.method).toBe('POST');
    expect(form.action).toBe('/app/session');
    const fieldTypes = form.fields.map((f) => f.type).sort();
    expect(fieldTypes).toEqual(['checkbox', 'email', 'password'].sort());
    const emailField = form.fields.find((f) => f.name === 'email')!;
    expect(emailField.required).toBe(true);
    expect(emailField.label).toBe('Email');
    expect(emailField.selectors.some((s) => s.strategy === 'id' && s.value === '#email')).toBe(true);
    // Submit selector prefers testId.
    expect(form.submitSelectors[0]!.strategy).toBe('testId');
    expect(form.submitSelectors[0]!.value).toBe('[data-testid="login-submit"]');
  }, 60_000);

  it('captures headings, image alt (accessibleName), duplicate-text buttons distinct via testId', async () => {
    const r = await engine.discover({
      baseUrl: `${fixture.url.replace(/\/$/, '')}/app/dashboard`,
      maxPages: 1,
      maxDepth: 0,
    });
    const p = r.application.pages[0]!;
    expect(p.headings.map((h) => h.text)).toEqual(
      expect.arrayContaining(['Dashboard', 'Recent Activity']),
    );
    // Two identical "Refresh" buttons — CSS selector for at least one should be unique.
    const refresh = p.elements.filter((e) => e.category === 'button' && e.accessibleName === 'Refresh');
    expect(refresh.length).toBe(2);
    // primary button distinguishable by testId
    const primary = p.elements.find((e) => e.testId === 'dashboard-primary');
    expect(primary).toBeDefined();
    expect(primary!.selectors[0]!.strategy).toBe('testId');
    // accessibility snapshot object present (root may be null on some headless_shell builds)
    expect(p.accessibility).toHaveProperty('nodeCount');
    expect(p.accessibility).toHaveProperty('truncated');
  }, 60_000);

  it('discovers select + radio options on products page', async () => {
    const r = await engine.discover({
      baseUrl: `${fixture.url.replace(/\/$/, '')}/app/products`,
      maxPages: 1,
      maxDepth: 0,
    });
    const p = r.application.pages[0]!;
    const cats = p.elements.filter((e) => e.category === 'select');
    expect(cats.length).toBeGreaterThan(0);
    const options = p.elements.filter((e) => e.category === 'option');
    expect(options.map((o) => o.text)).toEqual(expect.arrayContaining(['All', 'Books', 'Tools']));
    const radios = p.elements.filter((e) => e.category === 'radio');
    expect(radios.length).toBe(2);
    const checkedRadio = radios.find((r) => r.checked);
    expect(checkedRadio).toBeDefined();
  }, 60_000);
});

describe('DiscoveryEngine — crawl', () => {
  it('multi-page BFS discovers hub + linked pages within maxDepth', async () => {
    const r = await engine.discover({
      baseUrl: hubUrl(),
      maxPages: 10,
      maxDepth: 2,
    });
    const paths = r.application.pages.map((p) => p.path).sort();
    expect(paths).toEqual(
      expect.arrayContaining(['/app/hub', '/app/login', '/app/dashboard', '/app/products', '/app/checkout']),
    );
    expect(r.stats.pagesDiscovered).toBeGreaterThanOrEqual(5);
  }, 90_000);

  it('respects maxPages', async () => {
    const r = await engine.discover({ baseUrl: hubUrl(), maxPages: 2, maxDepth: 3 });
    expect(r.application.pages).toHaveLength(2);
    expect(r.warnings.some((w) => w.kind === 'max_pages_reached')).toBe(true);
  }, 60_000);

  it('respects maxDepth (only root page discovered when depth=0)', async () => {
    const r = await engine.discover({ baseUrl: hubUrl(), maxPages: 20, maxDepth: 0 });
    expect(r.application.pages).toHaveLength(1);
    expect(r.warnings.some((w) => w.kind === 'max_depth_reached')).toBe(true);
  }, 60_000);

  it('prevents cycles via visited set', async () => {
    const r = await engine.discover({
      baseUrl: `${fixture.url.replace(/\/$/, '')}/app/loop-a`,
      maxPages: 20,
      maxDepth: 5,
    });
    const paths = r.application.pages.map((p) => p.path).sort();
    expect(paths).toEqual(['/app/loop-a', '/app/loop-b']);
  }, 60_000);

  it('blocks external domain by default (sameOriginOnly)', async () => {
    const r = await engine.discover({ baseUrl: hubUrl(), maxPages: 20, maxDepth: 2 });
    const externalLinks = r.application.pages
      .flatMap((p) => p.links)
      .filter((l) => l.href.includes('example.com'));
    expect(externalLinks.length).toBeGreaterThan(0);
    for (const l of externalLinks) expect(l.inScope).toBe(false);
    // External page never enters pages list.
    expect(r.application.pages.some((p) => p.url.includes('example.com'))).toBe(false);
  }, 60_000);

  it('blocks server-side redirect to out-of-scope host with warning', async () => {
    const r = await engine.discover({
      baseUrl: `${fixture.url.replace(/\/$/, '')}/app/redirect-external`,
      maxPages: 5,
      maxDepth: 0,
    });
    expect(r.warnings.some((w) => w.kind === 'redirect_out_of_scope')).toBe(true);
    expect(r.application.pages).toHaveLength(0);
  }, 60_000);

  it('ignores mailto:, javascript:, and other unsupported protocols in links', async () => {
    const r = await engine.discover({ baseUrl: hubUrl(), maxPages: 20, maxDepth: 1 });
    const hub = r.application.pages.find((p) => p.path === '/app/hub');
    expect(hub).toBeDefined();
    const linkHrefs = hub!.links.map((l) => l.href);
    // mailto and javascript href are dropped entirely (not http/https).
    expect(linkHrefs.some((h) => h.startsWith('mailto:'))).toBe(false);
    expect(linkHrefs.some((h) => h.startsWith('javascript:'))).toBe(false);
  }, 60_000);
});

describe('DiscoveryEngine — privacy', () => {
  it('does NOT capture form field values', async () => {
    const r = await engine.discover({
      baseUrl: `${fixture.url.replace(/\/$/, '')}/app/login`,
      maxPages: 1,
      maxDepth: 0,
    });
    const page = r.application.pages[0]!;
    // No field object carries a value/defaultValue/currentValue-like key.
    const forbidden = ['value', 'defaultValue', 'currentValue', 'inputValue'];
    for (const field of page.forms.flatMap((f) => f.fields)) {
      for (const key of forbidden) expect(Object.keys(field)).not.toContain(key);
    }
    for (const el of page.elements) {
      // Discovered elements carry `text` (visible) but no user-typed value.
      for (const key of forbidden) expect(Object.keys(el)).not.toContain(key);
    }
    // Password field specifically.
    const pwField = page.forms[0]!.fields.find((f) => f.name === 'password')!;
    expect(pwField.type).toBe('password');
    expect(Object.keys(pwField)).not.toContain('value');
  }, 60_000);
});

describe('DiscoveryEngine — determinism', () => {
  it('two runs produce identical structural data (paths, element counts)', async () => {
    const a = await engine.discover({ baseUrl: hubUrl(), maxPages: 5, maxDepth: 2 });
    const b = await engine.discover({ baseUrl: hubUrl(), maxPages: 5, maxDepth: 2 });
    const norm = (r: typeof a) =>
      r.application.pages
        .map((p) => ({
          path: p.path,
          title: p.title,
          headings: p.headings.length,
          elements: p.elements.length,
          forms: p.forms.length,
        }))
        .sort((x, y) => x.path.localeCompare(y.path));
    expect(norm(a)).toEqual(norm(b));
  }, 120_000);
});

describe('DiscoveryEngine — invalid input', () => {
  it('throws on invalid baseUrl', async () => {
    await expect(engine.discover({ baseUrl: 'not-a-url' })).rejects.toThrow(/Invalid baseUrl/);
  });
});
