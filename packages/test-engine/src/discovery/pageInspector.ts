import type { Page } from 'playwright';
import type {
  AccessibilityNode,
  AccessibilitySnapshot,
  DiscoveredElement,
  DiscoveredForm,
  DiscoveredHeading,
  DiscoveredLink,
  PageModel,
  ResolvedDiscoveryOptions,
  SelectorCandidate,
} from './discoveryTypes.js';
import { isInScope, isAllowedProtocol, normalizeUrl, tryParseUrl } from './urlNormalizer.js';

interface RawInspection {
  title: string;
  headings: DiscoveredHeading[];
  elements: DiscoveredElement[];
  forms: DiscoveredForm[];
  rawLinks: Array<{ text: string; href: string; selectors: SelectorCandidate[] }>;
}

export async function inspectPage(
  page: Page,
  opts: ResolvedDiscoveryOptions,
): Promise<PageModel> {
  const raw = await page.evaluate(collectPageData, {
    maxElements: opts.maxElementsPerPage,
  });
  const accessibility = await captureAccessibility(page, opts.accessibilityMaxNodes);

  const currentUrl = new URL(page.url());
  const baseUrl = new URL(opts.baseUrl);
  const scope = {
    baseUrl,
    sameOriginOnly: opts.sameOriginOnly,
    allowedHosts: opts.allowedHosts,
  };

  const links: DiscoveredLink[] = raw.rawLinks
    .map((l): DiscoveredLink | null => {
      const parsed = tryParseUrl(l.href, currentUrl.href);
      if (!parsed || !isAllowedProtocol(parsed)) return null;
      return {
        text: l.text,
        href: l.href,
        normalizedUrl: normalizeUrl(parsed),
        inScope: isInScope(parsed, scope),
        selectors: l.selectors,
      };
    })
    .filter((x): x is DiscoveredLink => x !== null);

  return {
    url: normalizeUrl(currentUrl),
    path: currentUrl.pathname + currentUrl.search,
    title: raw.title,
    discoveredAt: new Date().toISOString(),
    headings: raw.headings,
    links,
    elements: raw.elements,
    forms: raw.forms,
    accessibility,
  };
}

interface AccessibilityApi {
  snapshot(opts?: { interestingOnly?: boolean; root?: unknown }): Promise<AxNode | null>;
}

async function captureAccessibility(
  page: Page,
  maxNodes: number,
): Promise<AccessibilitySnapshot> {
  try {
    const ax = (page as unknown as { accessibility?: AccessibilityApi }).accessibility;
    if (!ax) return { truncated: false, nodeCount: 0, root: null };
    const snapshot = await ax.snapshot({ interestingOnly: true });
    if (!snapshot) return { truncated: false, nodeCount: 0, root: null };
    const state = { count: 0, truncated: false };
    const root = convertAxNode(snapshot, state, maxNodes);
    return { truncated: state.truncated, nodeCount: state.count, root };
  } catch {
    return { truncated: false, nodeCount: 0, root: null };
  }
}

interface AxNode {
  role?: string;
  name?: string;
  children?: AxNode[];
}

function convertAxNode(
  n: AxNode,
  state: { count: number; truncated: boolean },
  max: number,
): AccessibilityNode | null {
  if (state.count >= max) {
    state.truncated = true;
    return null;
  }
  state.count += 1;
  const out: AccessibilityNode = { role: n.role ?? 'generic' };
  if (n.name) out.name = String(n.name).slice(0, 200);
  if (n.children && n.children.length > 0) {
    const kids: AccessibilityNode[] = [];
    for (const c of n.children) {
      const converted = convertAxNode(c, state, max);
      if (converted) kids.push(converted);
      if (state.truncated) break;
    }
    if (kids.length > 0) out.children = kids;
  }
  return out;
}

// The function below is stringified and executed inside the browser page.
// Keep it self-contained; do not reference outer scope.
function collectPageData(input: { maxElements: number }): RawInspection {
  const { maxElements } = input;

  const INTERACTIVE_SEL =
    'a[href], button, input, textarea, select, option, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="textbox"], [role="combobox"], [role="option"], [role="menuitem"]';

  const HEADINGS_SEL = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

  function escapeCss(v: string): string {
    // Prefer native CSS.escape; fall back to simple sanitizer.
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(v);
    }
    return v.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
  }

  function trimText(s: string | null | undefined, max = 80): string | undefined {
    if (!s) return undefined;
    const t = s.replace(/\s+/g, ' ').trim();
    if (!t) return undefined;
    return t.length > max ? t.slice(0, max) + '…' : t;
  }

  function isVisible(el: Element): boolean {
    const he = el as HTMLElement;
    if (!(he instanceof HTMLElement)) return true;
    const r = he.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const style = window.getComputedStyle(he);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }

  function isEnabled(el: Element): boolean {
    const dis = (el as HTMLInputElement | HTMLButtonElement | HTMLSelectElement).disabled;
    return dis !== true;
  }

  function labelText(el: Element): string | undefined {
    const id = (el as HTMLElement).id;
    if (id) {
      const l = document.querySelector(`label[for="${escapeCss(id)}"]`);
      if (l) return trimText(l.textContent);
    }
    const parent = el.closest('label');
    if (parent) {
      const cloned = parent.cloneNode(true) as HTMLElement;
      cloned.querySelectorAll('input, textarea, select').forEach((n) => n.remove());
      return trimText(cloned.textContent);
    }
    return undefined;
  }

  function implicitRole(el: Element): string | undefined {
    const tag = el.tagName.toLowerCase();
    if (tag === 'a' && (el as HTMLAnchorElement).href) return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'nav') return 'navigation';
    if (tag === 'form') return 'form';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    if (tag === 'option') return 'option';
    if (tag === 'img') return 'img';
    if (tag.match(/^h[1-6]$/)) return 'heading';
    if (tag === 'input') {
      const t = (el as HTMLInputElement).type.toLowerCase();
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'submit' || t === 'button' || t === 'reset') return 'button';
      return 'textbox';
    }
    return undefined;
  }

  function categoryFor(el: Element, role?: string): DiscoveredElement['category'] {
    const tag = el.tagName.toLowerCase();
    if (role === 'checkbox' || (tag === 'input' && (el as HTMLInputElement).type === 'checkbox'))
      return 'checkbox';
    if (role === 'radio' || (tag === 'input' && (el as HTMLInputElement).type === 'radio'))
      return 'radio';
    if (tag === 'button' || role === 'button') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
    if (tag === 'option') return 'option';
    if (tag === 'input') return 'input';
    if (tag === 'nav') return 'navigation';
    if (tag === 'form') return 'form';
    if (tag === 'img') return 'image';
    if (tag.match(/^h[1-6]$/)) return 'heading';
    return 'generic';
  }

  function cssPath(el: Element, root: Document = document): string {
    if ((el as HTMLElement).id) return `#${escapeCss((el as HTMLElement).id)}`;
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node.nodeType === 1 && node !== root.documentElement) {
      const parent: Element | null = node.parentElement;
      if (!parent) break;
      const tag = node.tagName.toLowerCase();
      const siblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      const index = siblings.indexOf(node) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      node = parent;
    }
    return parts.join(' > ');
  }

  function countMatching(sel: string): number {
    try {
      return document.querySelectorAll(sel).length;
    } catch {
      return -1;
    }
  }

  function candidatesFor(el: Element, accessibleName: string | undefined): SelectorCandidate[] {
    const out: SelectorCandidate[] = [];
    const push = (
      strategy: SelectorCandidate['strategy'],
      value: string,
      confidence: number,
      unique: boolean,
    ): void => {
      out.push({ strategy, value, confidence, unique });
    };

    const testId =
      el.getAttribute('data-testid') ??
      el.getAttribute('data-test-id') ??
      el.getAttribute('data-test');
    if (testId) {
      const v = `[data-testid="${escapeCss(testId)}"]`;
      push('testId', v, 0.98, countMatching(v) === 1);
    }

    const role = implicitRole(el) ?? el.getAttribute('role') ?? undefined;
    if (role && accessibleName) {
      const escName = accessibleName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const v = `role=${role}[name="${escName}"]`;
      // Uniqueness for role-based selectors is best-effort at collection time.
      push('role', v, 0.95, false);
    }

    const label = labelText(el);
    if (label) {
      const escLabel = label.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      push('label', `label=${escLabel}`, 0.9, false);
    }

    const name = el.getAttribute('name');
    if (name) {
      const v = `[name="${escapeCss(name)}"]`;
      push('name', v, 0.85, countMatching(v) === 1);
    }

    const id = (el as HTMLElement).id;
    if (id) {
      const v = `#${escapeCss(id)}`;
      push('id', v, 0.85, countMatching(v) === 1);
    }

    const path = cssPath(el);
    if (path) push('css', path, 0.6, countMatching(path) === 1);

    // Sort by (unique DESC, confidence DESC).
    out.sort((a, b) => {
      if (a.unique !== b.unique) return a.unique ? -1 : 1;
      return b.confidence - a.confidence;
    });
    return out;
  }

  function accessibleNameOf(el: Element): string | undefined {
    const aria = el.getAttribute('aria-label');
    if (aria) return trimText(aria);
    const l = labelText(el);
    if (l) return l;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const value = (el as HTMLInputElement).value;
      if ((el as HTMLInputElement).type === 'submit' || (el as HTMLInputElement).type === 'button')
        return trimText(value);
    }
    return trimText(el.textContent);
  }

  // Headings.
  const headings: DiscoveredHeading[] = [];
  document.querySelectorAll(HEADINGS_SEL).forEach((h) => {
    const level = h.tagName.match(/^H([1-6])$/i)
      ? Number(h.tagName[1])
      : Number(h.getAttribute('aria-level') ?? 2);
    const text = trimText(h.textContent);
    if (text) headings.push({ level, text });
  });

  // Links.
  const rawLinks: RawInspection['rawLinks'] = [];
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = (a as HTMLAnchorElement).getAttribute('href') ?? '';
    if (!href) return;
    const text = trimText(a.textContent) ?? href;
    const selectors = candidatesFor(a, text);
    rawLinks.push({ text, href, selectors });
  });

  // Interactive elements.
  const seen = new Set<Element>();
  const rawElements: DiscoveredElement[] = [];
  const elementNodes: Element[] = [];
  document.querySelectorAll(INTERACTIVE_SEL).forEach((el) => {
    if (seen.has(el) || rawElements.length >= maxElements) return;
    seen.add(el);
    elementNodes.push(el);
    const role = implicitRole(el) ?? el.getAttribute('role') ?? undefined;
    const accessibleName = accessibleNameOf(el);
    const category = categoryFor(el, role);
    const item: DiscoveredElement = {
      category,
      tagName: el.tagName.toLowerCase(),
      visible: isVisible(el),
      enabled: isEnabled(el),
      selectors: candidatesFor(el, accessibleName),
    };
    if (role) item.role = role;
    if (accessibleName) item.accessibleName = accessibleName;
    const text = trimText(el.textContent);
    if (text) item.text = text;
    const testId =
      el.getAttribute('data-testid') ??
      el.getAttribute('data-test-id') ??
      el.getAttribute('data-test');
    if (testId) item.testId = testId;
    if ((el as HTMLElement).id) item.id = (el as HTMLElement).id;
    const name = el.getAttribute('name');
    if (name) item.name = name;
    if (el.tagName.toLowerCase() === 'input') {
      item.type = (el as HTMLInputElement).type;
      if ((el as HTMLInputElement).placeholder) item.placeholder = (el as HTMLInputElement).placeholder;
      if ((el as HTMLInputElement).required) item.required = true;
      if ((el as HTMLInputElement).checked) item.checked = true;
    }
    if (el.tagName.toLowerCase() === 'textarea') {
      if ((el as HTMLTextAreaElement).placeholder) item.placeholder = (el as HTMLTextAreaElement).placeholder;
      if ((el as HTMLTextAreaElement).required) item.required = true;
    }
    if ((el as HTMLElement).getAttribute('aria-label')) item.ariaLabel = (el as HTMLElement).getAttribute('aria-label')!;
    if (el.tagName.toLowerCase() === 'a') {
      item.href = (el as HTMLAnchorElement).getAttribute('href') ?? undefined;
    }
    if ('disabled' in (el as HTMLInputElement) && (el as HTMLInputElement).disabled) {
      item.disabled = true;
    }
    rawElements.push(item);
  });

  // Forms.
  const forms: DiscoveredForm[] = [];
  document.querySelectorAll('form').forEach((form) => {
    const action = (form as HTMLFormElement).getAttribute('action') ?? undefined;
    const method = ((form as HTMLFormElement).getAttribute('method') ?? 'get').toUpperCase();
    const fields: DiscoveredForm['fields'] = [];
    form.querySelectorAll('input, textarea, select').forEach((f) => {
      if (rawElements.length === 0) return; // shouldn't happen but be safe
      const type =
        f.tagName.toLowerCase() === 'input'
          ? (f as HTMLInputElement).type.toLowerCase()
          : f.tagName.toLowerCase();
      const name = f.getAttribute('name') ?? undefined;
      const label = labelText(f);
      const placeholder =
        (f as HTMLInputElement | HTMLTextAreaElement).placeholder ?? undefined;
      const required = Boolean((f as HTMLInputElement).required);
      const field: DiscoveredForm['fields'][number] = {
        type,
        required,
        selectors: candidatesFor(f, label ?? name),
      };
      if (name) field.name = name;
      if (label) field.label = label;
      if (placeholder) field.placeholder = placeholder;
      fields.push(field);
    });

    const submitSelectors: SelectorCandidate[] = [];
    form
      .querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])')
      .forEach((sb) => {
        const name = accessibleNameOf(sb);
        submitSelectors.push(...candidatesFor(sb, name));
      });

    const item: DiscoveredForm = {
      method,
      selectors: candidatesFor(form, undefined),
      fields,
      submitSelectors,
    };
    if (action) item.action = action;
    forms.push(item);
  });

  return {
    title: document.title,
    headings,
    elements: rawElements,
    forms,
    rawLinks,
  };
}
