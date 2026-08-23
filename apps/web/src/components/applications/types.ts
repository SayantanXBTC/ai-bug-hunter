// Shared types for the Applications feature. Mirrors backend GET /api/applications
// and POST /api/discovery response shapes (extracted from existing Discovery.tsx).

export interface ApplicationRow {
  id: string;
  name: string;
  base_url: string;
  description?: string | null;
  created_at?: string;
}

export interface ApplicationListResponse {
  items: ApplicationRow[];
  page: number;
  limit: number;
  total: number;
}

export interface DiscoveredLink {
  text: string;
  normalizedUrl: string;
  inScope: boolean;
}

export interface SelectorCandidate {
  strategy: string;
  value: string;
  confidence: number;
  unique: boolean;
}

export interface DiscoveredElement {
  category: string;
  tagName: string;
  accessibleName?: string;
  role?: string;
  testId?: string;
  selectors: SelectorCandidate[];
}

export interface DiscoveredFormField {
  name?: string;
  type: string;
  label?: string;
  required: boolean;
  selectors: SelectorCandidate[];
}

export interface DiscoveredForm {
  method: string;
  action?: string;
  fields: DiscoveredFormField[];
  submitSelectors: SelectorCandidate[];
}

export interface PageModel {
  url: string;
  path: string;
  title: string;
  headings: Array<{ level: number; text: string }>;
  links: DiscoveredLink[];
  elements: DiscoveredElement[];
  forms: DiscoveredForm[];
}

export interface DiscoveryStats {
  pagesVisited: number;
  pagesDiscovered: number;
  linksFound: number;
  interactiveElements: number;
  forms: number;
  crawlDurationMs: number;
}

export interface DiscoveryResult {
  application: {
    id: string;
    baseUrl: string;
    discoveredAt: string;
    pages: PageModel[];
  };
  stats: DiscoveryStats;
  warnings: Array<{ kind: string; message: string; url?: string }>;
}
