export interface DiscoveryOptions {
  baseUrl: string;
  maxPages?: number;
  maxDepth?: number;
  sameOriginOnly?: boolean;
  allowedHosts?: string[];
  navigationTimeoutMs?: number;
  actionTimeoutMs?: number;
  pageSettleMs?: number;
  maxElementsPerPage?: number;
  accessibilityMaxNodes?: number;
  headless?: boolean;
}

export interface ResolvedDiscoveryOptions extends Required<Omit<DiscoveryOptions, 'allowedHosts'>> {
  allowedHosts: string[];
}

export const DEFAULT_DISCOVERY_OPTIONS: Omit<ResolvedDiscoveryOptions, 'baseUrl'> = {
  maxPages: 25,
  maxDepth: 3,
  sameOriginOnly: true,
  allowedHosts: [],
  navigationTimeoutMs: 15_000,
  actionTimeoutMs: 5_000,
  pageSettleMs: 200,
  maxElementsPerPage: 300,
  accessibilityMaxNodes: 500,
  headless: true,
};

export type SelectorStrategy =
  | 'testId'
  | 'role'
  | 'label'
  | 'name'
  | 'id'
  | 'css'
  | 'text';

export interface SelectorCandidate {
  strategy: SelectorStrategy;
  value: string;
  confidence: number;
  unique: boolean;
}

export type ElementCategory =
  | 'button'
  | 'link'
  | 'input'
  | 'textarea'
  | 'select'
  | 'option'
  | 'checkbox'
  | 'radio'
  | 'heading'
  | 'form'
  | 'navigation'
  | 'image'
  | 'generic';

export interface DiscoveredElement {
  category: ElementCategory;
  tagName: string;
  role?: string;
  accessibleName?: string;
  text?: string;
  testId?: string;
  id?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  ariaLabel?: string;
  href?: string;
  required?: boolean;
  disabled?: boolean;
  checked?: boolean;
  visible: boolean;
  enabled: boolean;
  selectors: SelectorCandidate[];
}

export interface DiscoveredFormField {
  name?: string;
  type: string;
  label?: string;
  placeholder?: string;
  required: boolean;
  selectors: SelectorCandidate[];
}

export interface DiscoveredForm {
  action?: string;
  method: string;
  selectors: SelectorCandidate[];
  fields: DiscoveredFormField[];
  submitSelectors: SelectorCandidate[];
}

export interface DiscoveredLink {
  text: string;
  href: string;
  normalizedUrl: string;
  inScope: boolean;
  selectors: SelectorCandidate[];
}

export interface AccessibilityNode {
  role: string;
  name?: string;
  children?: AccessibilityNode[];
}

export interface AccessibilitySnapshot {
  truncated: boolean;
  nodeCount: number;
  root: AccessibilityNode | null;
}

export interface DiscoveredHeading {
  level: number;
  text: string;
}

export interface PageModel {
  url: string;
  path: string;
  title: string;
  discoveredAt: string;
  headings: DiscoveredHeading[];
  links: DiscoveredLink[];
  elements: DiscoveredElement[];
  forms: DiscoveredForm[];
  accessibility: AccessibilitySnapshot;
}

export interface ApplicationModel {
  id: string;
  baseUrl: string;
  discoveredAt: string;
  pages: PageModel[];
}

export type DiscoveryWarningKind =
  | 'blocked_external'
  | 'blocked_protocol'
  | 'navigation_timeout'
  | 'redirect_out_of_scope'
  | 'duplicate_url'
  | 'selector_validation_failed'
  | 'max_pages_reached'
  | 'max_depth_reached'
  | 'inspect_failed';

export interface DiscoveryWarning {
  kind: DiscoveryWarningKind;
  message: string;
  url?: string;
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
  application: ApplicationModel;
  stats: DiscoveryStats;
  warnings: DiscoveryWarning[];
}
