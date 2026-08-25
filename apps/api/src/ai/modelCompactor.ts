import type { ApplicationModel } from '@ai-bug-hunter/test-engine';
import type { LLMApplicationContext } from './aiTypes.js';

export interface CompactionLimits {
  maxPages: number;
  maxElementsPerPage: number;
  maxFormsPerPage: number;
  maxLinksPerPage: number;
  maxSelectorsPerElement: number;
  maxPromptChars: number;
}

export const DEFAULT_COMPACTION_LIMITS: CompactionLimits = {
  maxPages: 10,
  maxElementsPerPage: 40,
  maxFormsPerPage: 5,
  maxLinksPerPage: 20,
  maxSelectorsPerElement: 3,
  maxPromptChars: 30_000,
};

export function compactApplicationModel(
  model: ApplicationModel,
  limits: CompactionLimits = DEFAULT_COMPACTION_LIMITS,
  targetPage?: string,
): LLMApplicationContext {
  let pages = model.pages;
  let effectiveMaxPages = limits.maxPages;
  if (targetPage) {
    pages = pages.filter((p) => p.path === targetPage || p.url === targetPage);
    if (pages.length === 0) pages = model.pages.slice(0, 1);
  } else {
    // No specific page → cap at 3 pages so the prompt stays under the
    // AI_PROMPT_MAX_CHARS budget for typical discovered surfaces.
    effectiveMaxPages = Math.min(3, limits.maxPages);
  }
  pages = pages.slice(0, effectiveMaxPages);

  return {
    baseUrl: model.baseUrl,
    discoveredAt: model.discoveredAt,
    pages: pages.map((p) => ({
      url: p.url,
      path: p.path,
      title: p.title,
      headings: p.headings.slice(0, 15),
      forms: p.forms.slice(0, limits.maxFormsPerPage).map((f) => {
        const out: LLMApplicationContext['pages'][number]['forms'][number] = {
          method: f.method,
          fields: f.fields.slice(0, 20).map((fd) => ({
            type: fd.type,
            required: fd.required,
            selectors: fd.selectors.slice(0, limits.maxSelectorsPerElement),
            ...(fd.name ? { name: fd.name } : {}),
            ...(fd.label ? { label: fd.label } : {}),
          })),
          submitSelectors: f.submitSelectors.slice(0, limits.maxSelectorsPerElement),
        };
        if (f.action) out.action = f.action;
        return out;
      }),
      elements: p.elements.slice(0, limits.maxElementsPerPage).map((e) => {
        const out: LLMApplicationContext['pages'][number]['elements'][number] = {
          category: e.category,
          tagName: e.tagName,
          selectors: e.selectors.slice(0, limits.maxSelectorsPerElement),
        };
        if (e.role) out.role = e.role;
        if (e.accessibleName) out.accessibleName = e.accessibleName;
        if (e.text) out.text = e.text;
        if (e.testId) out.testId = e.testId;
        return out;
      }),
      links: p.links
        .filter((l) => l.inScope)
        .slice(0, limits.maxLinksPerPage)
        .map((l) => ({ text: l.text, normalizedUrl: l.normalizedUrl, inScope: l.inScope })),
    })),
  };
}

export function estimatePromptChars(context: LLMApplicationContext): number {
  return JSON.stringify(context).length;
}
